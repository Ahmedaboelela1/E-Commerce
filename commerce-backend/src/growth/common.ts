import {Injectable} from '@nestjs/common';
import {
    ID,
    Product,
    ProductVariant,
    ProductVariantService,
    ProductService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
    Customer,
    Order,
} from '@vendure/core';
import {createHash, randomBytes} from 'node:crypto';
import {identifier, integer, text} from '../operations/rules';
import {GrowthSettings} from './entities';

export {identifier, integer, text};
// Native MySQL Order.orderPlacedAt stores whole seconds; feature timestamps retain microseconds.
// Compare at the precision available in the native placement record.
export function placedSince(placedAt: Date | null | undefined, since: Date) {
    return (
        !!placedAt && Math.floor(+placedAt / 1000) >= Math.floor(+since / 1000)
    );
}
export const token = () => randomBytes(32).toString('hex');
export const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
export function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new UserInputError('Invalid input');
    return value as Record<string, unknown>;
}
export function json<T>(value: string, fallback: T): T {
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}
export function url(value: unknown): string {
    const input = text(value, 2000, true);
    let parsed: URL;
    try {
        parsed = new URL(input);
    } catch {
        throw new UserInputError('Enter a valid HTTPS resource URL');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
        throw new UserInputError(
            'Use an HTTPS resource URL without credentials',
        );
    return parsed.href;
}
export function page(value = 0) {
    return integer(value, 0, 100000);
}

@Injectable()
export class GrowthCommon {
    constructor(
        public db: TransactionalConnection,
        private variants: ProductVariantService,
        private products: ProductService,
    ) {}
    preview(value: string | undefined) {
        if (!value) return null;
        if (/^https?:\/\//i.test(value)) return value;
        const base =
            process.env.BACKEND_PUBLIC_URL ||
            `http://localhost:${process.env.PORT || 3000}`;
        if (value.startsWith('/assets/')) return new URL(value, base).href;
        const prefix =
            process.env.ASSET_URL_PREFIX || new URL('/assets/', base).href;
        return new URL(value.replace(/^\/+/, ''), prefix.replace(/\/?$/, '/'))
            .href;
    }
    async settings(ctx: RequestContext) {
        return (
            (await this.db
                .getRepository(ctx, GrowthSettings)
                .findOneBy({channelId: identifier(ctx.channelId)})) ||
            new GrowthSettings({
                channelId: identifier(ctx.channelId),
                bundlePromotionId: null,
                returnsEnabled: false,
                returnWindowDays: 0,
                restockEnabled: true,
                cartRemindersEnabled: false,
                reminderHours: 24,
                version: 0,
            })
        );
    }
    async lockSettings(ctx: RequestContext) {
        const repo = this.db.getRepository(ctx, GrowthSettings);
        const row = await repo
            .createQueryBuilder('s')
            .where('s.channelId=:channel', {channel: ctx.channelId})
            .setLock('pessimistic_write')
            .getOne();
        return row || repo.save(await this.settings(ctx));
    }
    async saveSettings(ctx: RequestContext, value: unknown) {
        const input = object(value);
        const row = await this.lockSettings(ctx);
        if (integer(input.version, 0, 1000000) !== row.version)
            throw new UserInputError('Settings changed. Reload before saving.');
        const enabled = input.cartRemindersEnabled === true;
        if (enabled && process.env.EMAIL_ENABLED !== 'true')
            throw new UserInputError(
                'Configure transactional email before enabling reminders',
            );
        const returnsEnabled = input.returnsEnabled === true;
        const days = integer(input.returnWindowDays, 0, 365);
        if (returnsEnabled && !days)
            throw new UserInputError(
                'Configure the actual return window before enabling returns',
            );
        Object.assign(row, {
            returnsEnabled,
            returnWindowDays: days,
            restockEnabled: input.restockEnabled === true,
            cartRemindersEnabled: enabled,
            reminderHours: integer(input.reminderHours, 1, 168),
            version: row.version + 1,
        });
        return this.db.getRepository(ctx, GrowthSettings).save(row);
    }
    async product(ctx: RequestContext, id: ID, publicOnly = true) {
        const product = await this.db.findOneInChannel(
            ctx,
            Product,
            identifier(id),
            ctx.channelId,
            {relations: ['featuredAsset']},
        );
        if (!product || product.deletedAt || (publicOnly && !product.enabled))
            throw new UserInputError('Product not found');
        return product;
    }
    async variant(ctx: RequestContext, id: ID, publicOnly = true) {
        const variant = await this.variants.findOne(ctx, identifier(id), [
            'product',
            'product.featuredAsset',
        ]);
        if (!variant || variant.deletedAt)
            throw new UserInputError('Variant not found');
        await this.product(ctx, variant.productId, publicOnly);
        const product = await this.products.findOne(ctx, variant.productId, [
            'featuredAsset',
        ]);
        if (!product) throw new UserInputError('Product not found');
        variant.product = product;
        return variant;
    }
    async customer(ctx: RequestContext) {
        if (!ctx.activeUserId)
            throw new UserInputError(
                'Sign in with your verified customer account',
            );
        const c = await this.db.getRepository(ctx, Customer).findOne({
            where: {user: {id: ctx.activeUserId}},
            relations: ['user', 'channels'],
        });
        if (
            !c ||
            c.deletedAt ||
            !c.user?.verified ||
            !c.channels.some((ch) => String(ch.id) === String(ctx.channelId))
        )
            throw new UserInputError('Customer not found');
        return c;
    }
    async lockCustomer(ctx: RequestContext, id: ID) {
        return this.db
            .getRepository(ctx, Customer)
            .createQueryBuilder('c')
            .where('c.id=:id', {id})
            .setLock('pessimistic_write')
            .getOneOrFail();
    }
    async lockOrder(ctx: RequestContext, id: ID) {
        return this.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel')
            .where('o.id=:id AND channel.id=:channel', {
                id: identifier(id),
                channel: ctx.channelId,
            })
            .setLock('pessimistic_write')
            .getOneOrFail();
    }
}
