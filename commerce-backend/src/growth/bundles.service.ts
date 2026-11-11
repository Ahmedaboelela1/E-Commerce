import {randomUUID} from 'node:crypto';
import {Injectable} from '@nestjs/common';
import {
    ActiveOrderService,
    ID,
    LanguageCode,
    Order,
    OrderService,
    ProductVariantService,
    PromotionService,
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
    text,
} from './common';
import {CartBundle, GrowthSettings, ProductBundle} from './entities';

export interface BundleComponent {
    variantId: number;
    quantity: number;
}
@Injectable()
export class BundleService {
    constructor(
        private common: GrowthCommon,
        private variants: ProductVariantService,
        private promotions: PromotionService,
        private orders: OrderService,
        private activeOrders: ActiveOrderService,
    ) {}
    async ensurePromotion(ctx: RequestContext) {
        const row = await this.common.lockSettings(ctx);
        if (row.bundlePromotionId) return;
        const promotion = await this.promotions.createPromotion(ctx, {
            enabled: true,
            translations: [
                {
                    languageCode: LanguageCode.en,
                    name: 'Bundle savings',
                    description:
                        'Savings on complete configured bundles; component quantities remain stock-tracked.',
                },
            ],
            conditions: [{code: 'skillverse-complete-bundle', arguments: []}],
            actions: [{code: 'skillverse-bundle-savings', arguments: []}],
        });
        if ('errorCode' in promotion)
            throw new UserInputError(promotion.message);
        row.bundlePromotionId = identifier(promotion.id);
        await this.common.db
            .getRepository(ctx, GrowthSettings)
            .update(row.id, {bundlePromotionId: row.bundlePromotionId});
    }
    async save(ctx: RequestContext, value: unknown) {
        const input = object(value);
        const repo = this.common.db.getRepository(ctx, ProductBundle);
        const id = input.id ? identifier(String(input.id)) : null;
        const row = id
            ? await repo
                  .createQueryBuilder('b')
                  .where('b.id=:id AND b.channelId=:channel', {
                      id,
                      channel: ctx.channelId,
                  })
                  .setLock('pessimistic_write')
                  .getOne()
            : new ProductBundle({
                  channelId: identifier(ctx.channelId),
                  version: 0,
              });
        if (!row) throw new UserInputError('Bundle not found');
        if (row.version !== integer(input.version, 0, 1000000))
            throw new UserInputError('Bundle changed. Reload before saving.');
        if (
            !Array.isArray(input.components) ||
            input.components.length < 2 ||
            input.components.length > 12
        )
            throw new UserInputError('Choose 2–12 component variants');
        const components: BundleComponent[] = input.components.map((raw) => {
            const c = object(raw);
            return {
                variantId: identifier(String(c.variantId)),
                quantity: integer(c.quantity, 1, 100),
            };
        });
        if (
            new Set(components.map((c) => c.variantId)).size !==
            components.length
        )
            throw new UserInputError(
                'List each component once and set its quantity',
            );
        for (const c of components)
            await this.common.variant(ctx, c.variantId, false);
        const price = integer(input.price, 1, 100000000);
        Object.assign(row, {
            name: text(input.name, 200, true),
            description: text(input.description, 3000),
            components: JSON.stringify(components),
            price,
            enabled: input.enabled === true,
            sortOrder: integer(input.sortOrder ?? 0, 0, 1000000),
            version: row.version + 1,
        });
        await this.ensurePromotion(ctx);
        await repo.save(row);
        return this.describe(ctx, row, false);
    }
    private async describe(
        ctx: RequestContext,
        row: ProductBundle,
        publicOnly = true,
    ) {
        const components = json<BundleComponent[]>(row.components, []);
        const items = [];
        let normal = 0,
            available = true;
        for (const c of components) {
            const variant = await this.common.variant(
                ctx,
                c.variantId,
                publicOnly,
            );
            const stock = await this.variants.getSaleableStockLevel(
                ctx,
                variant,
            );
            normal +=
                (ctx.channel.pricesIncludeTax
                    ? variant.priceWithTax
                    : variant.price) * c.quantity;
            available = available && stock >= c.quantity;
            items.push({
                variantId: variant.id,
                productId: variant.productId,
                name: variant.name,
                sku: variant.sku,
                quantity: c.quantity,
                unitPrice: ctx.channel.pricesIncludeTax
                    ? variant.priceWithTax
                    : variant.price,
                preview: this.common.preview(
                    variant.product?.featuredAsset?.preview,
                ),
            });
        }
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            enabled: row.enabled,
            sortOrder: row.sortOrder,
            version: row.version,
            price: row.price,
            normalPrice: normal,
            saving: Math.max(0, normal - row.price),
            currencyCode: ctx.channel.defaultCurrencyCode,
            pricesIncludeTax: ctx.channel.pricesIncludeTax,
            available: available && normal >= row.price,
            components: items,
        };
    }
    async list(ctx: RequestContext, admin = false, skip = 0) {
        const [rows, total] = await this.common.db
            .getRepository(ctx, ProductBundle)
            .findAndCount({
                where: {
                    channelId: identifier(ctx.channelId),
                    ...(admin ? {} : {enabled: true}),
                },
                order: {sortOrder: 'ASC', id: 'ASC'},
                take: 50,
                skip: page(skip),
            });
        const items = [];
        for (const row of rows) {
            try {
                items.push(await this.describe(ctx, row, !admin));
            } catch (error) {
                if (admin) throw error;
            }
        }
        return {items, total};
    }
    async discount(ctx: RequestContext, order: Order) {
        if (order.couponCodes.length) return 0;
        const groups = await this.common.db
            .getRepository(ctx, CartBundle)
            .findBy({
                channelId: identifier(ctx.channelId),
                orderId: identifier(order.id),
            });
        let discount = 0;
        const activeKeys = new Set(
            order.lines
                .map((l) => l.customFields.skillverseBundleKey)
                .filter(Boolean),
        );
        for (const group of groups) {
            if (!activeKeys.has(group.groupKey)) continue;
            const bundle = await this.common.db
                .getRepository(ctx, ProductBundle)
                .findOneBy({
                    id: group.bundleId,
                    channelId: identifier(ctx.channelId),
                    enabled: true,
                });
            if (!bundle || bundle.components !== group.components) continue;
            const components = json<BundleComponent[]>(group.components, []);
            if (components.length < 2) continue;
            const lines = order.lines.filter(
                (l) => l.customFields.skillverseBundleKey === group.groupKey,
            );
            const count = Math.min(
                group.units,
                ...components.map((c) =>
                    Math.floor(
                        (lines.find(
                            (l) => Number(l.productVariantId) === c.variantId,
                        )?.quantity || 0) / c.quantity,
                    ),
                ),
            );
            if (count < 1) continue;
            const normal = components.reduce((sum, c) => {
                const line = lines.find(
                    (l) => Number(l.productVariantId) === c.variantId,
                );
                return (
                    sum +
                    (line
                        ? ctx.channel.pricesIncludeTax
                            ? line.discountedUnitPriceWithTax
                            : line.discountedUnitPrice
                        : 0) *
                        c.quantity
                );
            }, 0);
            if (normal > bundle.price)
                discount += (normal - bundle.price) * count;
        }
        return Math.min(
            Math.round(discount),
            ctx.channel.pricesIncludeTax
                ? order.subTotalWithTax
                : order.subTotal,
        );
    }
    async add(ctx: RequestContext, id: ID, quantity: number) {
        await this.common.customer(ctx);
        const count = integer(quantity, 1, 20);
        return this.common.db.withTransaction(ctx, async (tx) => {
            const row = await this.common.db
                .getRepository(tx, ProductBundle)
                .findOneBy({
                    id: identifier(id),
                    channelId: identifier(tx.channelId),
                    enabled: true,
                });
            if (!row) throw new UserInputError('Bundle not found');
            const details = await this.describe(tx, row);
            if (!details.available)
                throw new UserInputError(
                    'One or more bundle components are unavailable',
                );
            const order = await this.activeOrders.getActiveOrder(
                tx,
                undefined,
                true,
            );
            await this.common.lockOrder(tx, order.id);
            if (order.couponCodes.length)
                throw new UserInputError(
                    'Remove the coupon before adding a bundle; bundle savings do not combine with coupon codes',
                );
            const group = await this.common.db
                .getRepository(tx, CartBundle)
                .save(
                    new CartBundle({
                        channelId: identifier(tx.channelId),
                        orderId: identifier(order.id),
                        bundleId: identifier(row.id),
                        groupKey: randomUUID(),
                        components: row.components,
                        units: count,
                    }),
                );
            const result = await this.orders.addItemsToOrder(
                tx,
                order.id,
                details.components.map((c) => ({
                    productVariantId: c.variantId,
                    quantity: c.quantity * count,
                    customFields: {skillverseBundleKey: group.groupKey},
                })),
            );
            if (result.errorResults.length)
                throw new UserInputError(
                    result.errorResults.map((e) => e.message).join('; '),
                );
            return {
                orderId: result.order.id,
                total: result.order.totalWithTax,
                currencyCode: result.order.currencyCode,
            };
        });
    }
}
