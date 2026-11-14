import sanitizeHtml from 'sanitize-html';
import { Injectable } from '@nestjs/common';
import {
    ID,
    OrderService,
    PaymentMethod,
    PaymentMethodService,
    PaymentService,
    RequestContext,
    UserInputError,
} from '@vendure/core';
import { MarketplaceAccessService } from './access.service';
import { OrderOperationsService } from '../operations/order-operations.service';
import { identifier, text } from '../operations/rules';
import { object } from '../growth/common';
import { offlinePaymentType } from '../offline-payment-type';

@Injectable()
export class MarketplacePaymentsService {
    constructor(
        private access: MarketplaceAccessService,
        private methods: PaymentMethodService,
        private payments: PaymentService,
        private orders: OrderService,
        private ops: OrderOperationsService,
    ) {}
    async list(ctx: RequestContext) {
        const actor = await this.access.admin(ctx);
        const methods = await this.methods.findAll(actor.store, { take: 100 });
        return methods.items.map((method) => ({
            id: method.id,
            name: method.name,
            code: method.code,
            description: method.description,
            enabled: method.enabled,
            version: method.updatedAt.toISOString(),
            type: method.handler.code,
        }));
    }
    async save(ctx: RequestContext, value: unknown) {
        const actor = await this.access.admin(ctx),
            input = object(value),
            id = input.id ? identifier(input.id as ID) : null;
        const kind = text(input.type, 60, true);
        if (!['bank-transfer', 'cash-on-delivery'].includes(kind))
            throw new UserInputError(
                'Only the approved offline payment handlers are available',
            );
        const name = text(input.name, 200, true),
            description = sanitizeHtml(text(input.description, 10000), {
                allowedTags: ['p', 'br', 'strong', 'b', 'ul', 'li'],
                allowedAttributes: {},
            }),
            code = text(input.code, 80, true);
        if (
            kind === 'bank-transfer' &&
            !description.replace(/<[^>]*>/g, '').trim()
        )
            throw new UserInputError(
                'Provide the actual public receiving instructions',
            );
        return this.access.write(
            ctx,
            actor,
            'save-store-payment-method',
            async (tx) => {
                if (id) {
                    const existing = await this.access.db.findOneInChannel(
                        tx,
                        PaymentMethod,
                        id,
                        actor.store.channelId,
                        { relations: ['channels'] },
                    );
                    if (
                        !existing ||
                        existing.handler.code !== kind ||
                        existing.code !== code
                    )
                        throw new UserInputError(
                            'Payment method not found or its identity was changed',
                        );
                    if (input.version !== existing.updatedAt.toISOString())
                        throw new UserInputError(
                            'Payment method changed; refresh before editing its receiving instructions',
                        );
                    if (
                        existing.channels.some(
                            (channel) =>
                                channel.code !== '__default_channel__' &&
                                String(channel.id) !==
                                    String(actor.store.channelId),
                        )
                    )
                        throw new UserInputError(
                            'A SuperAdmin must separate a payment method shared with another store',
                        );
                }
                const common = {
                    enabled: input.enabled === true,
                    translations: [
                        {
                            languageCode:
                                actor.store.channel.defaultLanguageCode,
                            name,
                            description,
                        },
                    ],
                };
                const method = id
                    ? await this.methods.update(tx, { ...common, id })
                    : await this.methods.create(tx, {
                          ...common,
                          code,
                          handler: { code: kind, arguments: [] },
                      });
                return { id: method.id };
            },
        );
    }
    async collectCod(
        ctx: RequestContext,
        id: ID,
        confirmed: boolean,
        reference: string,
    ) {
        const actor = await this.access.admin(ctx);
        if (confirmed !== true)
            throw new UserInputError('Confirm that cash was actually received');
        const value = text(reference, 120, true),
            order = await this.ops.loadOrder(actor.store, id);
        const payment = order.payments?.find(
            (p) =>
                offlinePaymentType(p) === 'cash-on-delivery' &&
                p.state === 'Authorized',
        );
        if (order.state === 'Cancelled' || !payment)
            throw new UserInputError('No cash collection awaits confirmation');
        // Settlement uses the authenticated operator context, preserving handler checks.
        const result = await this.payments.settlePayment(
            actor.store,
            payment.id,
        );
        if ('errorCode' in result) throw new UserInputError(result.message);
        await this.orders.addNoteToOrder(actor.store, {
            id: order.id,
            note: `Actual cash receipt confirmed. Reference: ${value}`,
            isPublic: false,
        });
        return this.ops.adminOrder(actor.store, id);
    }
}
