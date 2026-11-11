import {
    Injectable,
    OnApplicationBootstrap,
    OnModuleDestroy,
} from '@nestjs/common';
import {
    Channel,
    Customer,
    EventBus,
    ID,
    Logger,
    Order,
    ProductVariantService,
    RequestContext,
    RequestContextService,
    StockMovementEvent,
    VendureEvent,
    UserInputError,
} from '@vendure/core';
import {createHmac} from 'node:crypto';
import {Subscription} from 'rxjs';
import {GrowthCommon, hash, identifier, token} from './common';
import {
    CartReminder,
    GrowthSettings,
    MailPreference,
    StockWatch,
} from './entities';

export class GrowthMailEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public recipient: string,
        public subject: string,
        public body: string,
    ) {
        super();
    }
}

@Injectable()
export class GrowthMailService
    implements OnApplicationBootstrap, OnModuleDestroy
{
    private subscription?: Subscription;
    constructor(
        private common: GrowthCommon,
        private events: EventBus,
        private variants: ProductVariantService,
        private contexts: RequestContextService,
    ) {}
    onApplicationBootstrap() {
        this.subscription = this.events
            .ofType(StockMovementEvent)
            .subscribe((e) => {
                void this.stockChanged(e).catch((error) =>
                    Logger.error(
                        'Stock notification check failed: ' + String(error),
                        'ShopGrowth',
                    ),
                );
            });
    }
    onModuleDestroy() {
        this.subscription?.unsubscribe();
    }
    private base(path: string) {
        return new URL(
            path,
            process.env.STOREFRONT_PUBLIC_URL || 'http://localhost:3001',
        ).href;
    }
    private signed(type: string, id: ID, channelId: ID) {
        const secret = process.env.COOKIE_SECRET;
        if (!secret)
            throw new Error('Cookie secret is required for notification links');
        return createHmac('sha256', secret)
            .update(`${type}:${id}:${channelId}`)
            .digest('hex');
    }
    private unsubscribeLink(type: string, id: ID, ctx: RequestContext) {
        return this.base(
            `/en/notifications/unsubscribe?kind=${type}&id=${id}&token=${this.signed(type, id, ctx.channelId)}`,
        );
    }
    async send(
        ctx: RequestContext,
        recipient: string,
        subject: string,
        body: string,
    ) {
        if (process.env.EMAIL_ENABLED === 'true')
            await this.events.publish(
                new GrowthMailEvent(
                    ctx,
                    recipient,
                    subject.replace(/[\r\n]/g, ' '),
                    body,
                ),
            );
    }
    async preferences(ctx: RequestContext) {
        const c = await this.common.customer(ctx);
        const pref = await this.common.db
            .getRepository(ctx, MailPreference)
            .findOneBy({
                channelId: identifier(ctx.channelId),
                customerId: identifier(c.id),
            });
        return {cartReminderConsent: pref?.cartReminderConsent || false};
    }
    async setPreference(ctx: RequestContext, consent: boolean) {
        const c = await this.common.customer(ctx);
        await this.common.lockCustomer(ctx, c.id);
        const repo = this.common.db.getRepository(ctx, MailPreference);
        const key = {
            channelId: identifier(ctx.channelId),
            customerId: identifier(c.id),
        };
        const row =
            (await repo.findOneBy(key)) ||
            new MailPreference({...key, unsubscribeHash: ''});
        row.cartReminderConsent = consent === true;
        row.consentedAt = consent ? new Date() : null;
        await repo.save(row);
        row.unsubscribeHash = hash(this.signed('cart', row.id, ctx.channelId));
        await repo.save(row);
        return this.preferences(ctx);
    }
    async watch(ctx: RequestContext, variantId: ID, active: boolean) {
        const c = await this.common.customer(ctx);
        const variant = await this.common.variant(ctx, variantId);
        await this.common.lockCustomer(ctx, c.id);
        if (active && !(await this.common.settings(ctx)).restockEnabled)
            throw new UserInputError(
                'Stock notifications are not currently available',
            );
        if (
            active &&
            (await this.variants.getSaleableStockLevel(ctx, variant)) > 0
        )
            throw new UserInputError('This variant is already available');
        const repo = this.common.db.getRepository(ctx, StockWatch);
        const key = {
            channelId: identifier(ctx.channelId),
            customerId: identifier(c.id),
            variantId: identifier(variantId),
        };
        const row =
            (await repo.findOneBy(key)) ||
            new StockWatch({...key, unsubscribeHash: '', notifiedAt: null});
        row.active = active === true;
        await repo.save(row);
        row.unsubscribeHash = hash(this.signed('stock', row.id, ctx.channelId));
        await repo.save(row);
        return this.watches(ctx);
    }
    async watches(ctx: RequestContext) {
        const c = await this.common.customer(ctx);
        const rows = await this.common.db
            .getRepository(ctx, StockWatch)
            .find({
                where: {
                    channelId: identifier(ctx.channelId),
                    customerId: identifier(c.id),
                    active: true,
                },
                take: 200,
                order: {createdAt: 'DESC'},
            });
        const items = [];
        for (const row of rows) {
            try {
                const v = await this.common.variant(ctx, row.variantId);
                items.push({
                    id: row.id,
                    variantId: v.id,
                    name: v.name,
                    productId: v.productId,
                    slug: v.product?.slug,
                    createdAt: row.createdAt,
                });
            } catch {}
        }
        return items;
    }
    async unsubscribe(
        ctx: RequestContext,
        kind: string,
        id: ID,
        value: string,
    ) {
        if (!['stock', 'cart'].includes(kind) || !/^[a-f0-9]{64}$/.test(value))
            throw new UserInputError('Invalid unsubscribe link');
        const key = {
            id: identifier(id),
            channelId: identifier(ctx.channelId),
            unsubscribeHash: hash(value),
        };
        if (kind === 'stock') {
            const r = await this.common.db
                .getRepository(ctx, StockWatch)
                .update(key, {active: false});
            if (!r.affected)
                throw new UserInputError('Invalid unsubscribe link');
        } else {
            const r = await this.common.db
                .getRepository(ctx, MailPreference)
                .update(key, {cartReminderConsent: false, consentedAt: null});
            if (!r.affected)
                throw new UserInputError('Invalid unsubscribe link');
        }
        return {unsubscribed: true};
    }
    async recovery(ctx: RequestContext, value: string) {
        const c = await this.common.customer(ctx);
        if (!/^[a-f0-9]{64}$/.test(value))
            throw new UserInputError('Invalid recovery link');
        const row = await this.common.db
            .getRepository(ctx, CartReminder)
            .findOneBy({
                channelId: identifier(ctx.channelId),
                customerId: identifier(c.id),
                tokenHash: hash(value),
            });
        if (!row || row.expiresAt < new Date()) return {available: false};
        const order = await this.common.db.findOneInChannel(
            ctx,
            Order,
            row.orderId,
            ctx.channelId,
        );
        if (
            !order?.active ||
            order.state !== 'AddingItems' ||
            String(order.customerId) !== String(c.id)
        )
            return {available: false};
        return {available: true, orderId: order.id};
    }
    private async stockChanged(event: StockMovementEvent) {
        const variantIds = [
            ...new Set(
                event.stockMovements.map((m) =>
                    identifier(m.productVariant.id),
                ),
            ),
        ];
        for (const variantId of variantIds) {
            const rows = await this.common.db.rawConnection
                .getRepository(StockWatch)
                .findBy({variantId, active: true});
            for (const channelId of new Set(rows.map((r) => r.channelId))) {
                const ch = await this.common.db.rawConnection
                    .getRepository(Channel)
                    .findOneBy({id: channelId});
                if (ch)
                    await this.notifyStock(
                        await this.contexts.create({
                            apiType: 'admin',
                            channelOrToken: ch,
                        }),
                        variantId,
                    );
            }
        }
    }
    async notifyStock(ctx: RequestContext, variantId: ID) {
        if (
            process.env.EMAIL_ENABLED !== 'true' ||
            !(await this.common.settings(ctx)).restockEnabled
        )
            return 0;
        let v;
        try {
            v = await this.common.variant(ctx, variantId);
        } catch {
            return 0;
        }
        if ((await this.variants.getSaleableStockLevel(ctx, v)) <= 0) return 0;
        const repo = this.common.db.getRepository(ctx, StockWatch);
        const rows = await repo.findBy({
            channelId: identifier(ctx.channelId),
            variantId: identifier(variantId),
            active: true,
        });
        let sent = 0;
        for (const row of rows) {
            const customer = await this.common.db
                .getRepository(ctx, Customer)
                .findOne({
                    where: {id: row.customerId},
                    relations: ['user', 'channels'],
                });
            if (
                !customer?.user?.verified ||
                customer.deletedAt ||
                !customer.channels.some(
                    (ch) => String(ch.id) === String(ctx.channelId),
                )
            )
                continue;
            const claimed = await repo.update(
                {id: row.id, active: true},
                {active: false, notifiedAt: new Date()},
            );
            if (!claimed.affected) continue;
            try {
                await this.send(
                    ctx,
                    customer.emailAddress,
                    `Back in stock — ${v.name}`,
                    `${v.name} is available again. Availability can change before checkout.\n${this.base(`/en/product/${encodeURIComponent(v.product.slug)}`)}\n\nUnsubscribe / إلغاء التنبيه:\n${this.unsubscribeLink('stock', row.id, ctx)}`,
                );
                sent++;
            } catch (error) {
                await repo.update(row.id, {active: true, notifiedAt: null});
                throw error;
            }
        }
        return sent;
    }
    async remindCarts(ctx: RequestContext) {
        const settings = await this.common.settings(ctx);
        if (
            !settings.cartRemindersEnabled ||
            process.env.EMAIL_ENABLED !== 'true'
        )
            return 0;
        const before = new Date(Date.now() - settings.reminderHours * 3600000);
        const orders = await this.common.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel')
            .innerJoinAndSelect('o.customer', 'customer')
            .innerJoinAndSelect('customer.user', 'user')
            .innerJoin('o.lines', 'line')
            .where('channel.id=:channel', {channel: ctx.channelId})
            .andWhere(
                'o.active=true AND o.state=:state AND o.updatedAt<:before AND user.verified=true AND customer.deletedAt IS NULL AND user.deletedAt IS NULL',
                {state: 'AddingItems', before},
            )
            .orderBy('o.updatedAt', 'ASC')
            .take(100)
            .getMany();
        let sent = 0;
        for (const order of orders) {
            await this.common.db.withTransaction(ctx, async (tx) => {
                await this.common.lockOrder(tx, order.id);
                const fresh = await this.common.db.findOneInChannel(
                    tx,
                    Order,
                    order.id,
                    ctx.channelId,
                );
                if (
                    !fresh?.active ||
                    fresh.state !== 'AddingItems' ||
                    fresh.updatedAt > before
                )
                    return;
                const pref = await this.common.db
                    .getRepository(tx, MailPreference)
                    .createQueryBuilder('p')
                    .where('p.channelId=:channel AND p.customerId=:customer', {
                        channel: tx.channelId,
                        customer: order.customer!.id,
                    })
                    .setLock('pessimistic_write')
                    .getOne();
                if (!pref?.cartReminderConsent) return;
                const repo = this.common.db.getRepository(tx, CartReminder);
                const key = {
                    channelId: identifier(ctx.channelId),
                    orderId: identifier(order.id),
                };
                if (await repo.existsBy(key)) return;
                const recoveryToken = token();
                const row = new CartReminder({
                    ...key,
                    customerId: identifier(order.customer!.id),
                    tokenHash: hash(recoveryToken),
                    expiresAt: new Date(Date.now() + 7 * 86400000),
                    sentAt: new Date(),
                });
                await repo.save(row);
                await this.send(
                    tx,
                    order.customer!.emailAddress,
                    'Your saved cart is waiting',
                    `You asked us to remind you about unfinished carts. Sign in to continue shopping. Product prices and stock are checked again at checkout.\n${this.base(`/en/cart/recover?token=${recoveryToken}`)}\n\nStop cart reminders / إيقاف تذكير السلة:\n${this.unsubscribeLink('cart', pref.id, tx)}`,
                );
                sent++;
            });
        }
        return sent;
    }
    async watchesForChannel(ctx: RequestContext) {
        const rows = await this.common.db
            .getRepository(ctx, StockWatch)
            .findBy({channelId: identifier(ctx.channelId), active: true});
        return [...new Set(rows.map((w) => w.variantId))];
    }
    async scan() {
        const channels = await this.common.db.rawConnection
            .getRepository(Channel)
            .find();
        let stock = 0,
            carts = 0;
        for (const ch of channels) {
            const ctx = await this.contexts.create({
                apiType: 'admin',
                channelOrToken: ch,
            });
            const watches = await this.common.db
                .getRepository(ctx, StockWatch)
                .findBy({channelId: identifier(ch.id), active: true});
            for (const id of new Set(watches.map((w) => w.variantId)))
                stock += await this.notifyStock(ctx, id);
            carts += await this.remindCarts(ctx);
        }
        return {stockNotifications: stock, cartReminders: carts};
    }
}
