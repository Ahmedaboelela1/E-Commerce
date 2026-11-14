import { Injectable } from '@nestjs/common';
import {
    Fulfillment,
    FulfillmentService,
    ID,
    Order,
    OrderService,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import { MarketplaceAccessService, StoreActor } from './access.service';
import { object } from '../growth/common';
import { identifier, integer, text, trackingUrl } from '../operations/rules';
import { OrderOperationsService } from '../operations/order-operations.service';

@Injectable()
export class MarketplaceOrdersService {
    constructor(
        private access: MarketplaceAccessService,
        private orders: OrderService,
        private fulfillments: FulfillmentService,
        private ops: OrderOperationsService,
    ) {}

    private async load(ctx: RequestContext, actor: StoreActor, id: ID) {
        const order = await this.orders.findOne(actor.store, identifier(id), [
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'customer',
            'payments',
            'payments.refunds',
            'fulfillments',
            'fulfillments.lines',
            'shippingLines',
            'shippingLines.shippingMethod',
        ]);
        if (
            !order ||
            order.active ||
            !order.lines.some(
                (line) =>
                    !actor.vendor ||
                    String(line.sellerChannelId) ===
                        String(actor.vendor.channelId),
            )
        )
            throw new UserInputError('Order not found');
        return order;
    }

    async list(ctx: RequestContext, skip = 0) {
        const actor = await this.access.actor(ctx);
        const qb = this.access.db
            .getRepository(ctx, Order)
            .createQueryBuilder('o')
            .innerJoin('o.channels', 'channel', 'channel.id=:channel', {
                channel: actor.store.channelId,
            })
            .where('o.active=false');
        if (actor.vendor)
            qb.innerJoin('o.lines', 'owned', 'owned.sellerChannelId=:seller', {
                seller: actor.vendor.channelId,
            });
        const total = await qb.getCount();
        const rows = await qb
            .orderBy('o.orderPlacedAt', 'DESC')
            .skip(integer(skip, 0, 100000))
            .take(30)
            .getMany();
        const items = [];
        for (const row of rows)
            items.push(
                await this.dto(ctx, actor, await this.load(ctx, actor, row.id)),
            );
        return { items, total };
    }

    async detail(ctx: RequestContext, id: ID) {
        const actor = await this.access.actor(ctx);
        return this.dto(ctx, actor, await this.load(ctx, actor, id));
    }
    private async dto(ctx: RequestContext, actor: StoreActor, order: Order) {
        const lines = order.lines.filter(
            (line) =>
                !actor.vendor ||
                String(line.sellerChannelId) === String(actor.vendor.channelId),
        );
        const ids = new Set(lines.map((line) => String(line.id))),
            shipIds = new Set(lines.map((line) => String(line.shippingLineId)));
        const shipping = order.shippingLines.filter(
            (line) => !actor.vendor || shipIds.has(String(line.id)),
        );
        const ops = await this.ops.adminOrder(actor.store, order.id);
        const fulfillmentRows = order.fulfillments.filter((f) =>
            f.lines.some((line) => ids.has(String(line.orderLineId))),
        );
        const ownAmount =
            lines.reduce(
                (sum, line) => sum + line.proratedLinePriceWithTax,
                0,
            ) +
            shipping.reduce(
                (sum, line) => sum + line.discountedPriceWithTax,
                0,
            );
        const paid =
            (order.payments || []).some((p) => p.state === 'Settled') &&
            !(order.payments || []).some((p) => p.state === 'Authorized');
        return {
            id: order.id,
            code: order.code,
            placedAt: order.orderPlacedAt,
            currencyCode: order.currencyCode,
            amount: actor.vendor ? ownAmount : order.totalWithTax,
            paid,
            phoneStatus: ops.phoneStatus,
            payments: actor.vendor
                ? undefined
                : (order.payments || []).map((p) => ({
                      id: p.id,
                      state: p.state,
                      amount: p.amount,
                      refunds: (p.refunds || []).map((r) => ({
                          id: r.id,
                          state: r.state,
                          total: r.total,
                      })),
                  })),
            state: order.state,
            address: order.shippingAddress,
            customerName: order.shippingAddress?.fullName || '',
            shipping: shipping.map((line) => ({
                name: line.shippingMethod?.name || '',
                price: line.discountedPriceWithTax,
            })),
            lines: lines.map((line) => ({
                id: line.id,
                name: line.productVariant.name,
                sku: line.productVariant.sku,
                quantity: line.quantity,
                amount: line.proratedLinePriceWithTax,
                remaining:
                    line.quantity -
                    fulfillmentRows
                        .filter((f) => f.state !== 'Cancelled')
                        .flatMap((f) => f.lines)
                        .filter(
                            (item) =>
                                String(item.orderLineId) === String(line.id),
                        )
                        .reduce((sum, item) => sum + item.quantity, 0),
            })),
            fulfillments: fulfillmentRows.map((f) => ({
                id: f.id,
                state: f.state,
                carrier: f.method,
                trackingCode: f.trackingCode,
                trackingUrl: trackingUrl(f.method, f.trackingCode),
                editable:
                    !actor.vendor ||
                    f.lines.every((line) => ids.has(String(line.orderLineId))),
            })),
        };
    }

    async dispatch(ctx: RequestContext, value: unknown) {
        const actor = await this.access.actor(ctx),
            input = object(value),
            order = await this.load(
                ctx,
                actor,
                identifier(input.orderId as ID),
            );
        if (!Array.isArray(input.lines) || !input.lines.length)
            throw new UserInputError('Select the items actually dispatched');
        const lines = input.lines.map((raw) => {
            const row = object(raw),
                id = identifier(row.id as ID);
            if (
                !order.lines.some(
                    (line) =>
                        String(line.id) === String(id) &&
                        (!actor.vendor ||
                            String(line.sellerChannelId) ===
                                String(actor.vendor.channelId)),
                )
            )
                throw new UserInputError('Order item not found');
            return {
                orderLineId: id,
                quantity: integer(row.quantity, 1, 10000),
            };
        });
        if (
            new Set(lines.map((line) => line.orderLineId)).size !== lines.length
        )
            throw new UserInputError('Duplicate order items');
        const carrier = text(input.carrier, 80, true),
            trackingCode = text(input.trackingCode, 120, true);
        return this.access.write(
            ctx,
            actor,
            'dispatch-seller-items',
            async (tx) => {
                const gate = await this.ops.shippingGate(tx, order.id);
                if (gate) throw new UserInputError(gate);
                const result = await this.orders.createFulfillment(tx, {
                    lines,
                    handler: {
                        code: 'manual-fulfillment',
                        arguments: [
                            { name: 'method', value: carrier },
                            { name: 'trackingCode', value: trackingCode },
                        ],
                    },
                });
                if ('errorCode' in result)
                    throw new UserInputError(result.message);
                const transitioned = await this.fulfillments.transitionToState(
                    tx,
                    result.id,
                    'Shipped',
                );
                if ('errorCode' in transitioned)
                    throw new UserInputError(transitioned.message);
                return { id: result.id };
            },
        );
    }

    async transition(ctx: RequestContext, id: ID, state: string) {
        const actor = await this.access.actor(ctx);
        if (!['Delivered', 'Cancelled'].includes(state))
            throw new UserInputError('Select a supported shipment state');
        const fulfillment = await this.access.db
            .getRepository(ctx, Fulfillment)
            .findOne({
                where: { id: identifier(id) },
                relations: [
                    'orders',
                    'orders.channels',
                    'lines',
                    'lines.orderLine',
                ],
            });
        if (
            !fulfillment ||
            !fulfillment.orders.length ||
            fulfillment.orders.some(
                (order) =>
                    !order.channels.some(
                        (channel) =>
                            String(channel.id) ===
                            String(actor.store.channelId),
                    ),
            ) ||
            (actor.vendor &&
                fulfillment.lines.some(
                    (line) =>
                        String(line.orderLine.sellerChannelId) !==
                        String(actor.vendor!.channelId),
                ))
        )
            throw new UserInputError('Shipment not found');
        return this.access.write(
            ctx,
            actor,
            'update-seller-shipment',
            async (tx) => {
                const result = await this.fulfillments.transitionToState(
                    tx,
                    fulfillment.id,
                    state as 'Delivered' | 'Cancelled',
                );
                if ('errorCode' in result)
                    throw new UserInputError(result.message);
                return { id: fulfillment.id };
            },
        );
    }
    async cancel(ctx: RequestContext, value: unknown) {
        const actor = await this.access.admin(ctx),
            input = object(value),
            order = await this.load(
                ctx,
                actor,
                identifier(input.orderId as ID),
            );
        const reason = text(input.reason, 255, true);
        if (order.fulfillments.some((f) => f.state !== 'Cancelled'))
            throw new UserInputError(
                'Resolve existing shipments before cancelling the order',
            );
        return this.access.write(
            ctx,
            actor,
            'cancel-store-order',
            async (tx) => {
                const result = await this.orders.cancelOrder(tx, {
                    orderId: order.id,
                    cancelShipping: true,
                    reason,
                });
                if ('errorCode' in result)
                    throw new UserInputError(result.message);
                return { id: order.id };
            },
        );
    }
    async refund(ctx: RequestContext, value: unknown) {
        const actor = await this.access.admin(ctx),
            input = object(value),
            order = await this.load(
                ctx,
                actor,
                identifier(input.orderId as ID),
            );
        const payment = order.payments?.find(
            (p) =>
                String(p.id) === String(input.paymentId) &&
                p.state === 'Settled',
        );
        if (!payment) throw new UserInputError('Collected payment not found');
        const amount = integer(input.amount, 1, payment.amount),
            reason = text(input.reason, 255, true);
        return this.access.write(
            ctx,
            actor,
            'create-store-refund',
            async (tx) => {
                const result = await this.orders.refundOrder(tx, {
                    paymentId: payment.id,
                    amount,
                    reason,
                });
                if ('errorCode' in result)
                    throw new UserInputError(result.message);
                return { id: result.id };
            },
        );
    }
    async settleRefund(ctx: RequestContext, value: unknown) {
        const actor = await this.access.admin(ctx),
            input = object(value),
            order = await this.load(
                ctx,
                actor,
                identifier(input.orderId as ID),
            );
        const refund = order.payments
            ?.flatMap((p) => p.refunds || [])
            .find(
                (r) =>
                    String(r.id) === String(input.refundId) &&
                    r.state === 'Pending',
            );
        if (!refund || input.confirmed !== true)
            throw new UserInputError('Confirm an actual refund for this order');
        const reference = text(input.reference, 120, true);
        return this.access.write(
            ctx,
            actor,
            'confirm-store-refund',
            async (tx) => {
                const result = await this.orders.settleRefund(tx, {
                    id: refund.id,
                    transactionId: reference,
                });
                return { id: result.id };
            },
        );
    }
}
