import {Injectable} from '@nestjs/common';
import {
    ID,
    Order,
    OrderService,
    Refund,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
    GrowthCommon,
    identifier,
    integer,
    json,
    object,
    page,
    placedSince,
    text,
} from './common';
import {ReturnCase} from './entities';
import {
    OrderOperationsService,
    ReceiptUpload,
} from '../operations/order-operations.service';
import {getAssetUploadDirectory} from '../asset-upload-directory';
import {GrowthMailService} from './mail.service';

interface ReturnItem {
    orderLineId: number;
    quantity: number;
    name: string;
    sku: string;
    amount: number;
}
interface ReturnPhoto {
    file: string;
    name: string;
    mime: string;
}
@Injectable()
export class ReturnsService {
    constructor(
        private common: GrowthCommon,
        private ops: OrderOperationsService,
        private orders: OrderService,
        private mail: GrowthMailService,
    ) {}
    private directory() {
        const assets = getAssetUploadDirectory();
        const configured = process.env.PRIVATE_RETURN_DIR?.trim();
        const dir = path.resolve(
            configured || path.join(path.dirname(assets), 'return-photos'),
        );
        if (
            (configured && !path.isAbsolute(configured)) ||
            dir === assets ||
            dir.startsWith(assets + path.sep) ||
            (process.env.APP_ENV !== 'dev' &&
                dir
                    .split(path.sep)
                    .some((p) => ['public_html', 'hbuilds'].includes(p)))
        )
            throw new UserInputError(
                'Private return-photo storage is not configured',
            );
        return dir;
    }
    private async row(
        ctx: RequestContext,
        id: ID,
        owner: boolean,
        lock = false,
    ) {
        const q = this.common.db
            .getRepository(ctx, ReturnCase)
            .createQueryBuilder('r')
            .where('r.id=:id AND r.channelId=:channel', {
                id: identifier(id),
                channel: ctx.channelId,
            });
        if (lock) q.setLock('pessimistic_write');
        const row = await q.getOne();
        if (!row) throw new UserInputError('Return request not found');
        if (owner) {
            const c = await this.common.customer(ctx);
            if (Number(c.id) !== row.customerId)
                throw new UserInputError('Return request not found');
        }
        return row;
    }
    private view(row: ReturnCase, admin = false) {
        const photos = json<ReturnPhoto[]>(row.photos, []);
        return {
            id: row.id,
            orderId: row.orderId,
            kind: row.kind,
            status: row.status,
            reason: row.reason,
            items: json<ReturnItem[]>(row.items, []),
            photoCount: photos.length,
            publicMessage: row.publicMessage || '',
            resolution: row.resolution,
            refundId: row.refundId,
            exchangeOrderId: row.exchangeOrderId,
            createdAt: row.createdAt,
            version: row.version,
            ...(admin
                ? {
                      customerId: row.customerId,
                      internalNotes: row.internalNotes || '',
                  }
                : {}),
        };
    }
    async eligibility(ctx: RequestContext, orderId: ID) {
        const order = await this.ops.loadOrder(ctx, orderId, true);
        const settings = await this.common.settings(ctx);
        const delivered = (order.fulfillments || [])
            .filter((f) => f.state === 'Delivered')
            .map((f) => +f.updatedAt);
        const deliveredAt = delivered.length
            ? new Date(Math.max(...delivered))
            : null;
        const existing = await this.common.db
            .getRepository(ctx, ReturnCase)
            .findBy({
                channelId: identifier(ctx.channelId),
                orderId: identifier(orderId),
            });
        const used = new Map<number, number>();
        for (const r of existing.filter(
            (r) => !['rejected', 'cancelled'].includes(r.status),
        ))
            for (const i of json<ReturnItem[]>(r.items, []))
                used.set(
                    i.orderLineId,
                    (used.get(i.orderLineId) || 0) + i.quantity,
                );
        const lines = order.lines
            .map((l) => ({
                id: l.id,
                name: l.productVariant.name || l.productVariant.sku,
                quantity: Math.max(
                    0,
                    l.quantity - (used.get(Number(l.id)) || 0),
                ),
            }))
            .filter((l) => l.quantity > 0);
        return {
            enabled: settings.returnsEnabled,
            windowDays: settings.returnWindowDays,
            eligible:
                lines.length > 0 &&
                settings.returnsEnabled &&
                order.state === 'Delivered' &&
                !!deliveredAt &&
                Date.now() - +deliveredAt <=
                    settings.returnWindowDays * 86400000,
            deliveredAt,
            lines,
        };
    }
    async request(ctx: RequestContext, orderId: ID, value: unknown) {
        const c = await this.common.customer(ctx);
        await this.common.lockOrder(ctx, orderId);
        const order = await this.ops.loadOrder(ctx, orderId, true);
        const eligibility = await this.eligibility(ctx, orderId);
        if (!eligibility.eligible)
            throw new UserInputError(
                'Online returns are not available for this order or return window. Please contact staff',
            );
        const input = object(value);
        const kind = text(input.kind, 20, true);
        if (!['refund', 'exchange'].includes(kind))
            throw new UserInputError('Choose refund or exchange');
        if (
            !Array.isArray(input.items) ||
            !input.items.length ||
            input.items.length > order.lines.length
        )
            throw new UserInputError(
                'Select the items and quantities to return',
            );
        const existing = await this.common.db
            .getRepository(ctx, ReturnCase)
            .findBy({
                channelId: identifier(ctx.channelId),
                orderId: identifier(orderId),
            });
        const used = new Map<number, number>();
        for (const row of existing.filter(
            (r) => !['rejected', 'cancelled'].includes(r.status),
        ))
            for (const i of json<ReturnItem[]>(row.items, []))
                used.set(
                    i.orderLineId,
                    (used.get(i.orderLineId) || 0) + i.quantity,
                );
        const seen = new Set<number>();
        const items: ReturnItem[] = input.items.map((raw) => {
            const i = object(raw);
            const id = identifier(String(i.orderLineId));
            const line = order.lines.find((l) => Number(l.id) === id);
            if (!line || seen.has(id))
                throw new UserInputError('Choose valid order items');
            seen.add(id);
            const quantity = integer(i.quantity, 1, line.quantity);
            if (quantity + (used.get(id) || 0) > line.quantity)
                throw new UserInputError(
                    'A return already covers this quantity',
                );
            return {
                orderLineId: id,
                quantity,
                name: line.productVariant.name || line.productVariant.sku,
                sku: line.productVariant.sku,
                amount: Math.round(
                    (line.proratedLinePriceWithTax * quantity) / line.quantity,
                ),
            };
        });
        const row = await this.common.db.getRepository(ctx, ReturnCase).save(
            new ReturnCase({
                channelId: identifier(ctx.channelId),
                customerId: identifier(c.id),
                orderId: identifier(orderId),
                kind,
                reason: text(input.reason, 3000, true),
                items: JSON.stringify(items),
                photos: '[]',
                status: 'requested',
                publicMessage: null,
                internalNotes: null,
                refundId: null,
                exchangeOrderId: null,
                resolution: null,
                version: 1,
            }),
        );
        await this.orders.addNoteToOrder(ctx, {
            id: orderId,
            note: `Customer requested ${kind}, return #${row.id}`,
            isPublic: false,
        });
        await this.mail.send(
            ctx,
            c.emailAddress,
            `Return request #${row.id} received`,
            `Your request has been received. Please wait for staff instructions before sending any items. A request does not confirm approval or a refund.\n${new URL('/en/account/returns', process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3001').href}`,
        );
        return this.view(row);
    }
    async list(ctx: RequestContext, admin = false, skip = 0) {
        const c = admin ? null : await this.common.customer(ctx);
        const [rows, total] = await this.common.db
            .getRepository(ctx, ReturnCase)
            .findAndCount({
                where: {
                    channelId: identifier(ctx.channelId),
                    ...(c ? {customerId: identifier(c.id)} : {}),
                },
                order: {createdAt: 'DESC'},
                take: 30,
                skip: page(skip),
            });
        return {items: rows.map((r) => this.view(r, admin)), total};
    }
    async upload(ctx: RequestContext, id: ID, file: Promise<ReceiptUpload>) {
        const row = await this.row(ctx, id, true, true);
        if (!['requested', 'authorized'].includes(row.status))
            throw new UserInputError('This return no longer accepts photos');
        const photos = json<ReturnPhoto[]>(row.photos, []);
        if (photos.length >= 3)
            throw new UserInputError('Up to three photos per return');
        const upload = await file;
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of upload.createReadStream()) {
            const b = Buffer.from(chunk);
            size += b.length;
            if (size > 5 * 1024 * 1024)
                throw new UserInputError('Photo must be at most 5 MB');
            chunks.push(b);
        }
        const data = Buffer.concat(chunks);
        if (
            !['image/png', 'image/jpeg', 'image/webp'].includes(upload.mimetype)
        )
            throw new UserInputError('Upload a PNG, JPEG or WebP photo');
        let format: string | undefined;
        try {
            const m = await sharp(data, {
                limitInputPixels: 40000000,
            }).metadata();
            format = m.format;
            if (
                !m.width ||
                !m.height ||
                !['png', 'jpeg', 'webp'].includes(format || '')
            )
                throw Error();
        } catch {
            throw new UserInputError('Invalid photo');
        }
        const ext = format === 'jpeg' ? 'jpg' : format;
        const filename = `${randomUUID()}.${ext}`;
        const dir = this.directory();
        await fs.mkdir(dir, {recursive: true, mode: 0o700});
        await fs.writeFile(path.join(dir, filename), data, {
            mode: 0o600,
            flag: 'wx',
        });
        try {
            photos.push({
                file: filename,
                name: path
                    .basename(upload.filename)
                    .replace(/[\x00-\x1f]/g, '')
                    .slice(0, 180),
                mime: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
            });
            row.photos = JSON.stringify(photos);
            row.version++;
            await this.common.db.getRepository(ctx, ReturnCase).save(row);
        } catch (error) {
            await fs.unlink(path.join(dir, filename)).catch(() => undefined);
            throw error;
        }
        return this.view(row);
    }
    async photo(ctx: RequestContext, id: ID, index: number, owner = true) {
        const row = await this.row(ctx, id, owner);
        const photos = json<ReturnPhoto[]>(row.photos, []);
        const p = photos[integer(index, 0, 2)];
        if (!p || !/^[a-f0-9-]+\.(png|jpg|webp)$/.test(p.file))
            throw new UserInputError('Photo not found');
        return {
            filename: p.name,
            mimeType: p.mime,
            dataBase64: (
                await fs.readFile(path.join(this.directory(), p.file))
            ).toString('base64'),
        };
    }
    async update(ctx: RequestContext, id: ID, value: unknown, version: number) {
        const row = await this.row(ctx, id, false, true);
        if (row.version !== version)
            throw new UserInputError('Return changed. Reload before saving.');
        const input = object(value);
        const next = text(input.status, 20, true);
        const transitions: Record<string, string[]> = {
            requested: ['requested', 'authorized', 'rejected'],
            authorized: ['authorized', 'received', 'rejected'],
            received: ['received', 'resolved'],
            resolved: [],
            rejected: [],
            cancelled: [],
        };
        if (!transitions[row.status]?.includes(next))
            throw new UserInputError('Invalid return status transition');
        const order = await this.ops.loadOrder(ctx, row.orderId);
        if (next === 'resolved') {
            const resolution = text(input.resolution, 20, true);
            if (resolution === 'refund') {
                const refundId = identifier(String(input.refundId));
                const refund = await this.common.db
                    .getRepository(ctx, Refund)
                    .findOne({
                        where: {id: refundId},
                        relations: ['payment', 'payment.order'],
                    });
                if (
                    !refund ||
                    refund.state !== 'Settled' ||
                    String(refund.payment.order.id) !== String(row.orderId)
                )
                    throw new UserInputError(
                        'Link an actual settled refund for this order from Orders',
                    );
                const amount = json<ReturnItem[]>(row.items, []).reduce(
                    (sum, i) => sum + i.amount,
                    0,
                );
                if (refund.total < amount)
                    throw new UserInputError(
                        'The linked settled refund does not cover the returned items',
                    );
                if (
                    await this.common.db
                        .getRepository(ctx, ReturnCase)
                        .existsBy({refundId})
                )
                    throw new UserInputError(
                        'This refund is already linked to a return',
                    );
                row.refundId = refundId;
            } else if (resolution === 'exchange') {
                const replacement = await this.ops.loadOrder(
                    ctx,
                    String(input.exchangeOrderId),
                );
                if (
                    String(replacement.id) === String(order.id) ||
                    !placedSince(replacement.orderPlacedAt, row.createdAt) ||
                    String(replacement.customerId) !== String(row.customerId) ||
                    replacement.state === 'Cancelled'
                )
                    throw new UserInputError(
                        'Link a placed replacement order for this customer and channel',
                    );
                row.exchangeOrderId = identifier(replacement.id);
            } else if (resolution === 'unpaid-cancelled') {
                if (
                    order.state !== 'Cancelled' ||
                    order.payments?.some((p) => p.state === 'Settled')
                )
                    throw new UserInputError(
                        'This resolution requires a cancelled order with no collected payment',
                    );
            } else
                throw new UserInputError(
                    'Link the real refund or replacement order to resolve the return',
                );
            row.resolution = resolution;
        }
        row.status = next;
        row.publicMessage = text(input.publicMessage, 3000);
        row.internalNotes = text(input.internalNotes, 3000);
        row.version++;
        await this.common.db.getRepository(ctx, ReturnCase).save(row);
        await this.orders.addNoteToOrder(ctx, {
            id: row.orderId,
            note: `Return #${row.id}: ${next}${row.resolution ? ' / ' + row.resolution : ''}\n${row.internalNotes}`,
            isPublic: false,
        });
        return this.view(row, true);
    }
    async cleanup() {
        if (!process.env.PRIVATE_RETURN_DIR && !process.env.ASSET_UPLOAD_DIR)
            return;
        const dir = this.directory();
        let files;
        try {
            files = await fs.readdir(dir, {withFileTypes: true});
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
            throw error;
        }
        const rows = await this.common.db.rawConnection
            .getRepository(ReturnCase)
            .find({select: {photos: true}});
        const used = new Set(
            rows.flatMap((r) =>
                json<ReturnPhoto[]>(r.photos, []).map((p) => p.file),
            ),
        );
        for (const f of files)
            if (
                f.isFile() &&
                !used.has(f.name) &&
                /^[a-f0-9-]+\.(png|jpg|webp)$/.test(f.name)
            ) {
                const name = path.join(dir, f.name);
                if ((await fs.stat(name)).mtimeMs < Date.now() - 86400000)
                    await fs.unlink(name);
            }
    }
}
