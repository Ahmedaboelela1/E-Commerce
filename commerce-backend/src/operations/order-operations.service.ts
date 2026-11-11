import {Injectable} from '@nestjs/common';
import {
    CustomerService,
    ID,
    Order,
    OrderService,
    PaymentService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {Readable} from 'node:stream';
import sharp from 'sharp';
import {MerchantSettings, OrderInvoice, OrderOperations} from './entities';
import {identifier, integer, shipmentAllowed, text, trackingUrl} from './rules';
import {getAssetUploadDirectory} from '../asset-upload-directory';

export interface ReceiptUpload {
    filename: string;
    mimetype: string;
    createReadStream(): Readable;
}

@Injectable()
export class OrderOperationsService {
    constructor(
        private db: TransactionalConnection,
        private customers: CustomerService,
        private orders: OrderService,
        private payments: PaymentService,
    ) {}

    async loadOrder(
        ctx: RequestContext,
        orderId: ID,
        owner = false,
    ): Promise<Order> {
        const order = await this.db.findOneInChannel(
            ctx,
            Order,
            identifier(orderId),
            ctx.channelId,
            {
                relations: [
                    'channels',
                    'customer',
                    'customer.user',
                    'lines',
                    'lines.productVariant',
                    'lines.productVariant.product',
                    'payments',
                    'payments.refunds',
                    'shippingLines',
                    'shippingLines.shippingMethod',
                    'fulfillments',
                    'fulfillments.lines',
                ],
            },
        );
        if (!order || order.active) throw new UserInputError('Order not found');
        if (owner) {
            if (
                !ctx.activeUserId ||
                String(order.customer?.user?.id) !== String(ctx.activeUserId)
            )
                throw new UserInputError('Order not found');
        }
        return order;
    }

    async customer(ctx: RequestContext) {
        if (!ctx.activeUserId)
            throw new UserInputError(
                'Sign in with a verified customer account',
            );
        const customer = await this.customers.findOneByUserId(
            ctx,
            ctx.activeUserId,
            true,
        );
        if (!customer) throw new UserInputError('Customer not found');
        return customer;
    }

    async settings(ctx: RequestContext) {
        return (
            (await this.db
                .getRepository(ctx, MerchantSettings)
                .findOneBy({channelId: identifier(ctx.channelId)})) ||
            new MerchantSettings({
                channelId: identifier(ctx.channelId),
                sellerName: '',
                sellerAddress: '',
                sellerTaxId: '',
                invoicePrefix: 'SV',
                lowStockEnabled: false,
                lowStockThreshold: 5,
                notificationEmail: '',
            })
        );
    }

    async saveSettings(ctx: RequestContext, input: Record<string, unknown>) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new UserInputError('Enter valid settings');
        if (
            input.lowStockEnabled === true &&
            process.env.EMAIL_ENABLED !== 'true'
        )
            throw new UserInputError(
                'Enable transactional email before enabling stock alerts',
            );
        const record = await this.settings(ctx);
        const prefix = text(input.invoicePrefix, 20, true).toUpperCase();
        if (!/^[A-Z0-9-]+$/.test(prefix))
            throw new UserInputError(
                'Invoice prefix must contain letters, digits or hyphens',
            );
        const email = text(input.notificationEmail, 254);
        if (
            (input.lowStockEnabled === true || email) &&
            !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)
        ) {
            throw new UserInputError('Enter one notification email address');
        }
        Object.assign(record, {
            sellerName: text(input.sellerName, 200),
            sellerAddress: text(input.sellerAddress, 1000),
            sellerTaxId: text(input.sellerTaxId, 100),
            invoicePrefix: prefix,
            notificationEmail: email,
            lowStockEnabled: input.lowStockEnabled === true,
            lowStockThreshold: integer(input.lowStockThreshold, 0, 10000),
        });
        return this.db.getRepository(ctx, MerchantSettings).save(record);
    }

    async record(ctx: RequestContext, orderId: ID) {
        return this.db
            .getRepository(ctx, OrderOperations)
            .findOneBy({
                channelId: identifier(ctx.channelId),
                orderId: identifier(orderId),
            });
    }

    private async lock(ctx: RequestContext, orderId: ID) {
        const order = await this.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel')
            .where('o.id = :id', {id: identifier(orderId)})
            .andWhere('channel.id = :channel', {channel: ctx.channelId})
            .setLock('pessimistic_write')
            .getOne();
        if (!order || order.active) throw new UserInputError('Order not found');
        return order;
    }

    async updateCallback(
        ctx: RequestContext,
        orderId: ID,
        phoneStatus: string,
        notes: string,
        version: number,
    ) {
        if (
            !['pending', 'confirmed', 'unreachable', 'cancelled'].includes(
                phoneStatus,
            )
        )
            throw new UserInputError('Invalid callback status');
        return this.db.withTransaction(ctx, async (tx) => {
            const order = await this.lock(tx, orderId);
            const record = await this.record(tx, orderId);
            if ((record?.version || 0) !== version)
                throw new UserInputError(
                    'This order changed. Reload before saving.',
                );
            if (order.state === 'Cancelled' && phoneStatus === 'confirmed')
                throw new UserInputError(
                    'A cancelled order cannot be confirmed',
                );
            const row =
                record ||
                new OrderOperations({
                    channelId: identifier(ctx.channelId),
                    orderId: identifier(orderId),
                    receiptStatus: 'none',
                });
            Object.assign(row, {
                phoneStatus,
                callbackNotes: text(notes, 2000),
                updatedByUserId: identifier(ctx.activeUserId!),
                version: version + 1,
            });
            await this.db.getRepository(tx, OrderOperations).save(row);
            await this.orders.addNoteToOrder(tx, {
                id: orderId,
                note: `Phone: ${phoneStatus}\n${row.callbackNotes}`,
                isPublic: false,
            });
            return this.adminOrder(tx, orderId);
        });
    }

    async publicOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.loadOrder(ctx, orderId, true);
        const row = await this.record(ctx, orderId);
        const settings = await this.settings(ctx);
        const savedInvoice = await this.db
            .getRepository(ctx, OrderInvoice)
            .existsBy({
                channelId: identifier(ctx.channelId),
                orderId: identifier(orderId),
            });
        return {
            orderId: order.id,
            phoneStatus: row?.phoneStatus || 'pending',
            receiptStatus: row?.receiptStatus || 'none',
            transferReference: row?.transferReference || '',
            receiptUploaded: !!row?.receiptFile,
            receiptReviewNote:
                row?.receiptStatus === 'rejected'
                    ? row.receiptReviewNote || ''
                    : '',
            invoiceAvailable:
                savedInvoice ||
                (order.state !== 'Cancelled' &&
                    !!settings.sellerName &&
                    !!settings.sellerAddress),
            transferPending:
                order.payments?.some(
                    (p) =>
                        p.method === 'bank-transfer' &&
                        p.state === 'Authorized',
                ) || false,
            shipments: this.shipments(order),
        };
    }

    private shipments(order: Order) {
        return (order.fulfillments || [])
            .filter((f) => f.state !== 'Cancelled')
            .map((f) => ({
                id: f.id,
                state: f.state,
                carrier: f.method,
                trackingCode: f.trackingCode,
                trackingUrl: trackingUrl(f.method || '', f.trackingCode || ''),
            }));
    }

    async adminOrder(ctx: RequestContext, orderId: ID) {
        const order = await this.loadOrder(ctx, orderId);
        const row = await this.record(ctx, orderId);
        return {
            id: order.id,
            code: order.code,
            state: order.state,
            currencyCode: order.currencyCode,
            total: order.totalWithTax,
            customerName:
                `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim(),
            email: order.customer?.emailAddress,
            phone:
                order.shippingAddress?.phoneNumber ||
                order.customer?.phoneNumber,
            phoneStatus: row?.phoneStatus || 'pending',
            notes: row?.callbackNotes || '',
            version: row?.version || 0,
            transferReference: row?.transferReference || '',
            receiptUploaded: !!row?.receiptFile,
            receiptStatus: row?.receiptStatus || 'none',
            receiptReviewNote: row?.receiptReviewNote || '',
            shipments: this.shipments(order),
            payments: order.payments?.map((p) => ({
                id: p.id,
                method: p.method,
                state: p.state,
                amount: p.amount,
            })),
            address: order.shippingAddress,
        };
    }

    async listOrders(ctx: RequestContext, search = '', skip = 0, take = 30) {
        const query = this.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel')
            .leftJoinAndSelect('o.customer', 'customer')
            .where('channel.id = :channel', {channel: ctx.channelId})
            .andWhere('o.active = false')
            .orderBy('o.orderPlacedAt', 'DESC')
            .skip(integer(skip, 0, 100000))
            .take(integer(take, 1, 100));
        if (search.trim())
            query.andWhere('o.code LIKE :search', {
                search: `%${text(search, 80)}%`,
            });
        const [orders, total] = await query.getManyAndCount();
        const items = await Promise.all(
            orders.map(async (order) => {
                const ops = await this.record(ctx, order.id);
                return {
                    id: order.id,
                    code: order.code,
                    state: order.state,
                    placedAt: order.orderPlacedAt,
                    total: order.totalWithTax,
                    currencyCode: order.currencyCode,
                    customer: order.customer?.emailAddress,
                    phoneStatus: ops?.phoneStatus || 'pending',
                    receiptStatus: ops?.receiptStatus || 'none',
                };
            }),
        );
        return {items, total};
    }

    async shippingGate(ctx: RequestContext, orderId: ID) {
        const order = await this.loadOrder(ctx, orderId);
        const egypt = order.channels.some(
            (channel) => channel.code === 'skillverse-eg',
        );
        if (!egypt) return;
        if (ctx.channel.code !== 'skillverse-eg')
            return 'Select the skillverse-eg channel to fulfill Egypt orders.';
        const row = await this.record(ctx, orderId);
        return shipmentAllowed(
            row?.phoneStatus || 'pending',
            order.payments?.some(
                (p) => p.method === 'bank-transfer' && p.state === 'Authorized',
            ) || false,
        );
    }

    async dispatch(
        ctx: RequestContext,
        orderId: ID,
        carrierInput: string,
        codeInput: string,
    ) {
        return this.db.withTransaction(ctx, async (tx) => {
            await this.lock(tx, orderId);
            return this.dispatchLocked(tx, orderId, carrierInput, codeInput);
        });
    }

    private async dispatchLocked(
        ctx: RequestContext,
        orderId: ID,
        carrierInput: string,
        codeInput: string,
    ) {
        const order = await this.loadOrder(ctx, orderId);
        const error = await this.shippingGate(ctx, orderId);
        if (error) throw new UserInputError(error);
        const carrier = text(carrierInput, 40, true).toLowerCase();
        if (!['aramex', 'dhl', 'other'].includes(carrier))
            throw new UserInputError('Choose a carrier');
        const code = text(codeInput, 120, true);
        if (!/^[A-Za-z0-9._-]+$/.test(code))
            throw new UserInputError('Invalid tracking code');
        if (order.state === 'Cancelled')
            throw new UserInputError('Cannot ship a cancelled order');
        if (order.fulfillments?.some((f) => f.state === 'Pending'))
            throw new UserInputError(
                'Complete the existing pending fulfillment in Orders first',
            );
        const lines = order.lines
            .map((line) => {
                const fulfilled = (order.fulfillments || [])
                    .filter((f) => f.state !== 'Cancelled')
                    .flatMap((f) => f.lines || [])
                    .filter((fl) => String(fl.orderLineId) === String(line.id))
                    .reduce((sum, fl) => sum + fl.quantity, 0);
                return {
                    orderLineId: line.id,
                    quantity: line.quantity - fulfilled,
                };
            })
            .filter((line) => line.quantity > 0);
        if (!lines.length)
            throw new UserInputError('No unfulfilled items remain');
        const fulfillment = await this.orders.createFulfillment(ctx, {
            lines,
            handler: {
                code: 'manual-fulfillment',
                arguments: [
                    {name: 'method', value: carrier},
                    {name: 'trackingCode', value: code},
                ],
            },
        });
        if ('errorCode' in fulfillment)
            throw new UserInputError(fulfillment.message);
        const shipped = await this.orders.transitionFulfillmentToState(
            ctx,
            fulfillment.id,
            'Shipped',
        );
        if ('errorCode' in shipped) throw new UserInputError(shipped.message);
        return this.adminOrder(ctx, orderId);
    }

    private receiptsDirectory(): string {
        const assets = getAssetUploadDirectory();
        const configured = process.env.PRIVATE_RECEIPT_DIR?.trim();
        const directory = path.resolve(
            configured || path.join(path.dirname(assets), 'transfer-proofs'),
        );
        if (
            (configured && !path.isAbsolute(configured)) ||
            directory === assets ||
            directory.startsWith(assets + path.sep) ||
            (process.env.APP_ENV !== 'dev' &&
                directory
                    .split(path.sep)
                    .some((p) => ['public_html', 'hbuilds'].includes(p)))
        ) {
            throw new UserInputError(
                'Private receipt storage is not configured correctly',
            );
        }
        return directory;
    }

    async submitProof(
        ctx: RequestContext,
        orderId: ID,
        referenceInput: string,
        file?: Promise<ReceiptUpload>,
    ) {
        const order = await this.loadOrder(ctx, orderId, true);
        if (
            order.state === 'Cancelled' ||
            !order.payments?.some(
                (p) => p.method === 'bank-transfer' && p.state === 'Authorized',
            )
        ) {
            throw new UserInputError('This order has no pending bank transfer');
        }
        const reference = text(referenceInput, 120);
        if (!reference && !file)
            throw new UserInputError(
                'Enter a transfer reference or attach an image',
            );
        let filename: string | null = null,
            original = '',
            mime = '';
        if (file) {
            const upload = await file;
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of upload.createReadStream()) {
                const buffer = Buffer.isBuffer(chunk)
                    ? chunk
                    : Buffer.from(chunk);
                size += buffer.length;
                if (size > 5 * 1024 * 1024)
                    throw new UserInputError(
                        'Receipt images must be at most 5 MB',
                    );
                chunks.push(buffer);
            }
            const buffer = Buffer.concat(chunks);
            const ext = buffer
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
                ? 'png'
                : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
                  ? 'jpg'
                  : buffer.subarray(0, 4).toString() === 'RIFF' &&
                      buffer.subarray(8, 12).toString() === 'WEBP'
                    ? 'webp'
                    : null;
            if (
                !ext ||
                !['image/png', 'image/jpeg', 'image/webp'].includes(
                    upload.mimetype,
                )
            )
                throw new UserInputError(
                    'Upload a PNG, JPEG or WebP receipt image',
                );
            try {
                const image = await sharp(buffer, {
                    limitInputPixels: 40000000,
                }).metadata();
                if (
                    !image.width ||
                    !image.height ||
                    !['png', 'jpeg', 'webp'].includes(image.format || '')
                )
                    throw new Error('Invalid image');
            } catch {
                throw new UserInputError('The receipt is not a valid image');
            }
            mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            original = path
                .basename(upload.filename)
                .replace(/[\x00-\x1f]/g, '')
                .slice(0, 180);
            filename = `${randomUUID()}.${ext}`;
            const directory = this.receiptsDirectory();
            await fs.mkdir(directory, {recursive: true, mode: 0o700});
            await fs.writeFile(path.join(directory, filename), buffer, {
                mode: 0o600,
                flag: 'wx',
            });
        }
        try {
            await this.db.withTransaction(ctx, async (tx) => {
                await this.lock(tx, orderId);
                const current = await this.loadOrder(tx, orderId, true);
                if (
                    current.state === 'Cancelled' ||
                    !current.payments?.some(
                        (p) =>
                            p.method === 'bank-transfer' &&
                            p.state === 'Authorized',
                    )
                )
                    throw new UserInputError(
                        'This transfer no longer awaits proof',
                    );
                const row =
                    (await this.record(tx, orderId)) ||
                    new OrderOperations({
                        channelId: identifier(ctx.channelId),
                        orderId: identifier(orderId),
                        phoneStatus: 'pending',
                        version: 0,
                    });
                row.transferReference = reference;
                row.receiptStatus = 'pending';
                row.receiptReviewNote = null;
                row.version++;
                if (filename) {
                    row.receiptFile = filename;
                    row.receiptName = original;
                    row.receiptMime = mime;
                }
                await this.db.getRepository(tx, OrderOperations).save(row);
            });
        } catch (error) {
            if (filename)
                await fs
                    .unlink(path.join(this.receiptsDirectory(), filename))
                    .catch(() => undefined);
            throw error;
        }
        return this.publicOrder(ctx, orderId);
    }

    async receipt(ctx: RequestContext, orderId: ID) {
        await this.loadOrder(ctx, orderId);
        const row = await this.record(ctx, orderId);
        if (
            !row?.receiptFile ||
            !/^[a-f0-9-]+\.(png|jpg|webp)$/.test(row.receiptFile)
        )
            return null;
        const data = await fs.readFile(
            path.join(this.receiptsDirectory(), row.receiptFile),
        );
        return {
            filename: row.receiptName,
            mimeType: row.receiptMime,
            dataBase64: data.toString('base64'),
        };
    }

    async verifyTransfer(
        ctx: RequestContext,
        orderId: ID,
        reference: string,
        confirmFundsReceived: boolean,
    ) {
        if (confirmFundsReceived !== true)
            throw new UserInputError('Confirm actual receipt of funds first');
        const verifiedReference = text(reference, 120, true);
        return this.db.withTransaction(ctx, async (tx) => {
            await this.lock(tx, orderId);
            const order = await this.loadOrder(tx, orderId);
            if (order.state === 'Cancelled')
                throw new UserInputError(
                    'Cannot verify payment on a cancelled order',
                );
            const payment = order.payments?.find(
                (p) => p.method === 'bank-transfer' && p.state === 'Authorized',
            );
            if (!payment)
                throw new UserInputError(
                    'No bank transfer awaits verification',
                );
            const result = await this.payments.settlePayment(tx, payment.id);
            if ('errorCode' in result) throw new UserInputError(result.message);
            const row =
                (await this.record(tx, orderId)) ||
                new OrderOperations({
                    channelId: identifier(ctx.channelId),
                    orderId: identifier(orderId),
                    phoneStatus: 'pending',
                    version: 0,
                });
            row.transferReference = verifiedReference;
            row.receiptStatus = 'accepted';
            row.version++;
            await this.db.getRepository(tx, OrderOperations).save(row);
            await this.orders.addNoteToOrder(tx, {
                id: orderId,
                note: `Bank receipt verified by staff. Reference: ${verifiedReference}`,
                isPublic: false,
            });
            return this.adminOrder(tx, orderId);
        });
    }

    async rejectProof(ctx: RequestContext, orderId: ID, note: string) {
        return this.db.withTransaction(ctx, async (tx) => {
            await this.lock(tx, orderId);
            const order = await this.loadOrder(tx, orderId);
            if (
                order.state === 'Cancelled' ||
                !order.payments?.some(
                    (p) =>
                        p.method === 'bank-transfer' &&
                        p.state === 'Authorized',
                )
            )
                throw new UserInputError('No transfer awaits review');
            const row = await this.record(tx, orderId);
            if (!row) throw new UserInputError('No proof was submitted');
            row.receiptStatus = 'rejected';
            row.receiptReviewNote = text(note, 1000, true);
            row.version++;
            await this.db.getRepository(tx, OrderOperations).save(row);
            await this.orders.addNoteToOrder(tx, {
                id: orderId,
                note: `Transfer proof rejected: ${row.receiptReviewNote}`,
                isPublic: false,
            });
            return this.adminOrder(tx, orderId);
        });
    }

    async cleanupReceipts() {
        if (!process.env.PRIVATE_RECEIPT_DIR && !process.env.ASSET_UPLOAD_DIR)
            return;
        const directory = this.receiptsDirectory();
        let files;
        try {
            files = await fs.readdir(directory, {withFileTypes: true});
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
            throw error;
        }
        const rows = await this.db.rawConnection
            .getRepository(OrderOperations)
            .find({select: {receiptFile: true}});
        const used = new Set(rows.map((row) => row.receiptFile));
        for (const file of files) {
            if (
                !file.isFile() ||
                used.has(file.name) ||
                !/^[a-f0-9-]+\.(png|jpg|webp)$/.test(file.name)
            )
                continue;
            const filename = path.join(directory, file.name);
            const stats = await fs.stat(filename);
            if (stats.mtimeMs < Date.now() - 86400000)
                await fs.unlink(filename);
        }
    }
}
