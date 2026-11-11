import {Injectable} from '@nestjs/common';
import {
    Customer,
    ID,
    OrderService,
    RequestContext,
    UserInputError,
} from '@vendure/core';
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
import {SchoolQuote} from './entities';
import {GrowthMailService} from './mail.service';
import {OrderOperationsService} from '../operations/order-operations.service';

interface QuoteItem {
    variantId: number;
    quantity: number;
    name: string;
    sku: string;
    unitPrice: number;
}
interface QuoteOffer {
    items: QuoteItem[];
    shipping: number;
    currencyCode: string;
    expiresAt: string;
    message: string;
    sellerName: string;
    sellerAddress: string;
}
@Injectable()
export class SchoolQuotesService {
    constructor(
        private common: GrowthCommon,
        private mail: GrowthMailService,
        private ops: OrderOperationsService,
        private orders: OrderService,
    ) {}
    private async view(ctx: RequestContext, row: SchoolQuote, admin = false) {
        const c = admin
            ? await this.common.db
                  .getRepository(ctx, Customer)
                  .findOneBy({id: row.customerId})
            : null;
        return {
            id: row.id,
            createdAt: row.createdAt,
            organization: row.organization,
            phone: row.phone,
            notes: row.notes,
            items: json<QuoteItem[]>(row.items, []),
            address: row.address ? json(row.address, {}) : null,
            status: row.status,
            version: row.version,
            offer:
                row.offer &&
                (admin ||
                    ['quoted', 'accepted', 'completed'].includes(row.status))
                    ? json(row.offer, null)
                    : null,
            orderId: row.orderId,
            ...(admin
                ? {
                      customerId: row.customerId,
                      customerName:
                          `${c?.firstName || ''} ${c?.lastName || ''}`.trim(),
                      email: c?.emailAddress,
                  }
                : {}),
        };
    }
    async request(ctx: RequestContext, value: unknown) {
        const c = await this.common.customer(ctx);
        const input = object(value);
        const phone = text(input.phone, 30, true);
        if (
            !/^\+?[0-9 ()-]{10,25}$/.test(phone) ||
            phone.replace(/\D/g, '').length < 10 ||
            phone.replace(/\D/g, '').length > 15
        )
            throw new UserInputError('Enter a contact phone number');
        if (
            !Array.isArray(input.items) ||
            !input.items.length ||
            input.items.length > 50
        )
            throw new UserInputError('Choose 1–50 products for the quotation');
        const items: QuoteItem[] = [];
        for (const raw of input.items) {
            const i = object(raw);
            const v = await this.common.variant(ctx, String(i.variantId));
            if (items.some((item) => item.variantId === Number(v.id)))
                throw new UserInputError('List each variant once');
            items.push({
                variantId: identifier(v.id),
                quantity: integer(i.quantity, 1, 10000),
                name: v.name,
                sku: v.sku,
                unitPrice: v.priceWithTax,
            });
        }
        const address = input.address ? object(input.address) : null;
        const safeAddress = address
            ? {
                  street: text(address.street, 300),
                  city: text(address.city, 100),
                  governorate: text(address.governorate, 100),
              }
            : null;
        await this.common.lockCustomer(ctx, c.id);
        const repo = this.common.db.getRepository(ctx, SchoolQuote);
        const open = await repo.countBy({
            channelId: identifier(ctx.channelId),
            customerId: identifier(c.id),
            status: 'requested',
        });
        if (open >= 20)
            throw new UserInputError(
                'Please wait for staff to review your open quotation requests',
            );
        const row = await repo.save(
            new SchoolQuote({
                channelId: identifier(ctx.channelId),
                customerId: identifier(c.id),
                organization: text(input.organization, 200, true),
                phone,
                notes: text(input.notes, 3000),
                items: JSON.stringify(items),
                address: safeAddress ? JSON.stringify(safeAddress) : null,
                offer: null,
                status: 'requested',
                orderId: null,
                version: 1,
            }),
        );
        await this.mail.send(
            ctx,
            c.emailAddress,
            `Quotation request #${row.id} received`,
            `We received your quotation request for ${row.organization}. Our team will review prices, availability and delivery before making an offer. No order or payment has been created.\n${new URL('/en/account/quotes', process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3001').href}`,
        );
        if (process.env.EMAIL_ADMIN_TO)
            await this.mail.send(
                ctx,
                process.env.EMAIL_ADMIN_TO,
                `New school quotation #${row.id}`,
                `${row.organization}\n${phone}\n${new URL('/dashboard/shop-customer-care', process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000').href}`,
            );
        return this.view(ctx, row);
    }
    async list(ctx: RequestContext, admin = false, skip = 0) {
        const c = admin ? null : await this.common.customer(ctx);
        const [rows, total] = await this.common.db
            .getRepository(ctx, SchoolQuote)
            .findAndCount({
                where: {
                    channelId: identifier(ctx.channelId),
                    ...(!admin ? {customerId: identifier(c!.id)} : {}),
                },
                order: {createdAt: 'DESC'},
                take: 30,
                skip: page(skip),
            });
        return {
            items: await Promise.all(rows.map((r) => this.view(ctx, r, admin))),
            total,
        };
    }
    private async locked(ctx: RequestContext, id: ID) {
        const row = await this.common.db
            .getRepository(ctx, SchoolQuote)
            .createQueryBuilder('q')
            .where('q.id=:id AND q.channelId=:channel', {
                id: identifier(id),
                channel: ctx.channelId,
            })
            .setLock('pessimistic_write')
            .getOne();
        if (!row) throw new UserInputError('Quote not found');
        return row;
    }
    async offer(
        ctx: RequestContext,
        id: ID,
        value: unknown,
        version: number,
        publish: boolean,
    ) {
        const row = await this.locked(ctx, id);
        const input = object(value);
        if (row.version !== version)
            throw new UserInputError('Quote changed. Reload before saving.');
        if (!['requested', 'reviewing', 'quoted'].includes(row.status))
            throw new UserInputError(
                'An accepted or closed quote cannot be repriced',
            );
        const original = json<QuoteItem[]>(row.items, []);
        if (
            !Array.isArray(input.items) ||
            input.items.length !== original.length
        )
            throw new UserInputError('Price every requested product');
        const seen = new Set<number>();
        const items: QuoteItem[] = input.items.map((raw) => {
            const i = object(raw);
            const variantId = identifier(String(i.variantId));
            const source = original.find((r) => r.variantId === variantId);
            if (!source || seen.has(variantId))
                throw new UserInputError(
                    'Quote products do not match the request',
                );
            seen.add(variantId);
            return {
                ...source,
                quantity: integer(i.quantity, 1, 10000),
                unitPrice: integer(i.unitPrice, 0, 100000000),
            };
        });
        const expires = new Date(text(input.expiresAt, 50, true));
        if (
            !Number.isFinite(+expires) ||
            expires <= new Date() ||
            +expires > Date.now() + 90 * 86400000
        )
            throw new UserInputError(
                'Choose an expiry within the next 90 days',
            );
        const seller = await this.ops.settings(ctx);
        if (publish && (!seller.sellerName || !seller.sellerAddress))
            throw new UserInputError(
                'Configure the actual seller name and address in Shop operations Settings',
            );
        const offer: QuoteOffer = {
            items,
            shipping: integer(input.shipping, 0, 100000000),
            currencyCode: ctx.channel.defaultCurrencyCode,
            expiresAt: expires.toISOString(),
            message: text(input.message, 3000),
            sellerName: seller.sellerName,
            sellerAddress: seller.sellerAddress || '',
        };
        if (
            items.reduce(
                (sum, i) => sum + i.quantity * i.unitPrice,
                offer.shipping,
            ) <= 0
        )
            throw new UserInputError('Quote total must be positive');
        row.offer = JSON.stringify(offer);
        row.status = publish ? 'quoted' : 'reviewing';
        row.version++;
        await this.common.db.getRepository(ctx, SchoolQuote).save(row);
        if (publish) {
            const c = await this.common.db
                .getRepository(ctx, Customer)
                .findOneBy({id: row.customerId});
            if (c)
                await this.mail.send(
                    ctx,
                    c.emailAddress,
                    `Your quotation #${row.id} is ready`,
                    `Your offer from ${offer.sellerName} is ready to review. It includes the proposed product prices and delivery charge, and expires on ${offer.expiresAt.slice(0, 10)}.\n${new URL('/en/account/quotes', process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3001').href}`,
                );
        }
        return this.view(ctx, row, true);
    }
    async respond(
        ctx: RequestContext,
        id: ID,
        accept: boolean,
        version: number,
    ) {
        const c = await this.common.customer(ctx);
        const row = await this.locked(ctx, id);
        if (row.customerId !== Number(c.id))
            throw new UserInputError('Quote not found');
        if (row.version !== version)
            throw new UserInputError(
                'Quote changed. Reload before responding.',
            );
        if (row.status !== 'quoted' || !row.offer)
            throw new UserInputError('No published offer awaits a response');
        const offer = json<QuoteOffer | null>(row.offer, null);
        if (!offer || new Date(offer.expiresAt) < new Date())
            throw new UserInputError(
                'This offer has expired. Please contact staff for a new offer',
            );
        row.status = accept ? 'accepted' : 'declined';
        row.version++;
        await this.common.db.getRepository(ctx, SchoolQuote).save(row);
        return this.view(ctx, row);
    }
    async linkOrder(ctx: RequestContext, id: ID, orderId: ID, version: number) {
        const row = await this.locked(ctx, id);
        if (row.version !== version || row.status !== 'accepted')
            throw new UserInputError(
                'Reload the accepted quote before linking an order',
            );
        const order = await this.ops.loadOrder(ctx, orderId);
        const offer = json<QuoteOffer | null>(row.offer || '', null);
        if (
            !offer ||
            !placedSince(order.orderPlacedAt, row.createdAt) ||
            order.state === 'Cancelled' ||
            String(order.customerId) !== String(row.customerId) ||
            order.currencyCode !== offer.currencyCode
        )
            throw new UserInputError(
                'Choose a placed order belonging to this quote customer and channel',
            );
        if (
            order.totalWithTax !==
            offer.items.reduce(
                (sum, i) => sum + i.quantity * i.unitPrice,
                offer.shipping,
            )
        )
            throw new UserInputError(
                'The order total must match the accepted quotation',
            );
        if (order.shippingWithTax !== offer.shipping)
            throw new UserInputError(
                'The delivery charge must match the accepted quotation',
            );
        for (const item of offer.items)
            if (
                !order.lines.some(
                    (l) =>
                        Number(l.productVariantId) === item.variantId &&
                        l.quantity === item.quantity &&
                        l.proratedLinePriceWithTax ===
                            item.unitPrice * item.quantity,
                )
            )
                throw new UserInputError(
                    'The order items must match the accepted quotation',
                );
        if (order.lines.length !== offer.items.length)
            throw new UserInputError(
                'The order items must match the accepted quotation',
            );
        row.orderId = identifier(orderId);
        row.status = 'completed';
        row.version++;
        await this.common.db.getRepository(ctx, SchoolQuote).save(row);
        await this.orders.addNoteToOrder(ctx, {
            id: orderId,
            note: `Created from accepted school quotation #${row.id}`,
            isPublic: false,
        });
        return this.view(ctx, row, true);
    }
}
