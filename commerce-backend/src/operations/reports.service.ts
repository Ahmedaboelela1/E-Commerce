import {Injectable} from '@nestjs/common';
import {
    Order,
    Payment,
    PromotionService,
    Refund,
    RequestContext,
    TransactionalConnection,
    UserInputError,
    LanguageCode,
    ProductVariantService,
} from '@vendure/core';
import {integer, text} from './rules';

@Injectable()
export class ShopReportsService {
    constructor(
        private db: TransactionalConnection,
        private promotions: PromotionService,
        private variants: ProductVariantService,
    ) {}

    async report(ctx: RequestContext, fromInput: string, toInput: string) {
        const from = new Date(fromInput),
            to = new Date(toInput);
        if (
            !Number.isFinite(+from) ||
            !Number.isFinite(+to) ||
            from >= to ||
            +to - +from > 366 * 86400000
        ) {
            throw new UserInputError(
                'Choose a valid reporting range of at most one year',
            );
        }
        const orders = this.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel')
            .where('channel.id = :channel', {channel: ctx.channelId})
            .andWhere('o.active = false')
            .andWhere('o.orderPlacedAt >= :from AND o.orderPlacedAt < :to', {
                from,
                to,
            });
        const summary = await orders
            .clone()
            .select('COUNT(*)', 'count')
            .addSelect(
                'COALESCE(SUM(o.subTotalWithTax + o.shippingWithTax),0)',
                'gross',
            )
            .andWhere('o.state != :cancelled', {cancelled: 'Cancelled'})
            .getRawOne();
        const cancelled = await orders
            .clone()
            .andWhere('o.state = :cancelled', {cancelled: 'Cancelled'})
            .getCount();
        const paymentQuery = this.db
            .getRepository(ctx, Payment)
            .createQueryBuilder('p')
            .innerJoin('p.order', 'o')
            .innerJoin('o.channels', 'channel')
            .where('channel.id = :channel', {channel: ctx.channelId})
            .andWhere('o.active = false')
            .andWhere('o.orderPlacedAt >= :from AND o.orderPlacedAt < :to', {
                from,
                to,
            });
        const paid = await paymentQuery
            .clone()
            .select('COALESCE(SUM(p.amount),0)', 'amount')
            .andWhere('p.state = :state', {state: 'Settled'})
            .getRawOne();
        const pending = await paymentQuery
            .clone()
            .select('COALESCE(SUM(p.amount),0)', 'amount')
            .andWhere('p.state = :state', {state: 'Authorized'})
            .getRawOne();
        const refunds = await this.db
            .getRepository(ctx, Refund)
            .createQueryBuilder('r')
            .innerJoin('r.payment', 'p')
            .innerJoin('p.order', 'o')
            .innerJoin('o.channels', 'channel')
            .select('COALESCE(SUM(r.total),0)', 'amount')
            .where('channel.id = :channel', {channel: ctx.channelId})
            .andWhere('o.orderPlacedAt >= :from AND o.orderPlacedAt < :to', {
                from,
                to,
            })
            .andWhere('r.state = :state', {state: 'Settled'})
            .getRawOne();
        const products = await orders
            .clone()
            .innerJoin('o.lines', 'line')
            .innerJoin('line.productVariant', 'variant')
            .select('variant.productId', 'productId')
            .addSelect('line.productVariantId', 'variantId')
            .addSelect('SUM(line.quantity)', 'quantity')
            .andWhere('o.state != :cancelled', {cancelled: 'Cancelled'})
            .groupBy('variant.productId')
            .addGroupBy('line.productVariantId')
            .orderBy('quantity', 'DESC')
            .limit(10)
            .getRawMany();
        return {
            from: from.toISOString(),
            to: to.toISOString(),
            currencyCode: ctx.channel.defaultCurrencyCode,
            orderCount: Number(summary?.count || 0),
            cancelledCount: cancelled,
            gross: Number(summary?.gross || 0),
            collected: Number(paid?.amount || 0) - Number(refunds?.amount || 0),
            refunded: Number(refunds?.amount || 0),
            pending: Number(pending?.amount || 0),
            topProducts: await Promise.all(
                products.map(async (p) => {
                    const variant = await this.variants.findOne(
                        ctx,
                        p.variantId,
                    );
                    return {
                        ...p,
                        name: variant?.name || `Variant ${p.variantId}`,
                        sku: variant?.sku || '',
                        quantity: Number(p.quantity),
                    };
                }),
            ),
        };
    }

    async createCoupon(ctx: RequestContext, input: Record<string, unknown>) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
            throw new UserInputError('Enter a valid coupon');
        const code = text(input.code, 30, true).toUpperCase();
        if (!/^[A-Z0-9_-]+$/.test(code))
            throw new UserInputError(
                'Coupon code must contain letters, digits, hyphens or underscores',
            );
        const percent = integer(input.percent, 1, 99);
        const minimum = integer(input.minimum, 0, 100000000);
        const limit = integer(input.usageLimit, 1, 1000000);
        const startsAt = input.startsAt
            ? new Date(String(input.startsAt))
            : null;
        const endsAt = input.endsAt ? new Date(String(input.endsAt)) : null;
        if (
            (startsAt && !Number.isFinite(+startsAt)) ||
            (endsAt && !Number.isFinite(+endsAt)) ||
            (startsAt && endsAt && startsAt >= endsAt)
        )
            throw new UserInputError('Invalid coupon dates');
        const result = await this.promotions.createPromotion(ctx, {
            enabled: input.enabled === true,
            couponCode: code,
            perCustomerUsageLimit: 1,
            usageLimit: limit,
            startsAt,
            endsAt,
            translations: [
                {
                    languageCode: LanguageCode.en,
                    name: text(input.name, 100, true),
                    description: '',
                },
            ],
            conditions: minimum
                ? [
                      {
                          code: 'minimum_order_amount',
                          arguments: [
                              {name: 'amount', value: String(minimum)},
                              {name: 'taxInclusive', value: 'true'},
                          ],
                      },
                  ]
                : [],
            actions: [
                {
                    code: 'order_percentage_discount',
                    arguments: [{name: 'discount', value: String(percent)}],
                },
            ],
        });
        if ('errorCode' in result) throw new UserInputError(result.message);
        return {
            id: result.id,
            name: result.name,
            couponCode: result.couponCode,
            enabled: result.enabled,
        };
    }
}
