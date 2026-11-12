import {offlinePaymentType} from '../offline-payment-type';
import {
    defaultFulfillmentProcess,
    defaultOrderProcess,
    FulfillmentHandler,
    FulfillmentProcess,
    LanguageCode,
    manualFulfillmentHandler,
    OrderProcess,
    PluginCommonModule,
    ScheduledTask,
    UserInputError,
    VendurePlugin,
} from '@vendure/core';
import {operationsEntities} from './entities';
import {OperationsShopResolver, OperationsAdminResolver, OfflinePaymentQuoteResolver} from './resolvers';
import {OrderOperationsService} from './order-operations.service';
import {ShopSocialService} from './social.service';
import {ShopReportsService} from './reports.service';
import {ShopInvoiceService} from './invoice.service';
import {ShopInventoryService} from './inventory.service';
import {adminSchema, shopSchema} from './schema';

let operations: OrderOperationsService;
const guardedManualHandler = new FulfillmentHandler({
    code: 'manual-fulfillment',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Manually enter fulfillment details after order confirmation',
        },
    ],
    args: {
        method: {type: 'string', required: false},
        trackingCode: {type: 'string', required: false},
    },
    init(injector) {
        operations = injector.get(OrderOperationsService);
    },
    async createFulfillment(ctx, orders, _lines, args) {
        // Check before Vendure persists a Created fulfillment and reserves its lines.
        for (const order of orders) {
            const error = await operations.shippingGate(ctx, order.id);
            if (error) throw new UserInputError(error);
        }
        return {method: args.method, trackingCode: args.trackingCode};
    },
});
const orderGate: OrderProcess<never> = {
    transitions: {
        PaymentAuthorized: {
            to: [
                'PartiallyShipped',
                'Shipped',
                'PartiallyDelivered',
                'Delivered',
            ],
        },
    },
    init(injector) {
        operations = injector.get(OrderOperationsService);
    },
    async onTransitionStart(from, to, data) {
        if (
            [
                'Shipped',
                'PartiallyShipped',
                'Delivered',
                'PartiallyDelivered',
            ].includes(to)
        ) {
            if (from === 'PaymentAuthorized') {
                const order = await operations.loadOrder(
                    data.ctx,
                    data.order.id,
                );
                if (
                    data.ctx.channel.code !== 'skillverse-eg' ||
                    !order.payments?.some(
                        (p) =>
                            offlinePaymentType(p) === 'cash-on-delivery' &&
                            p.state === 'Authorized',
                    )
                ) {
                    return 'Only confirmed Egypt cash-on-delivery orders may ship before collection';
                }
            }
            return operations.shippingGate(data.ctx, data.order.id);
        }
    },
};
const fulfillmentGate: FulfillmentProcess<never> = {
    init(injector) {
        operations = injector.get(OrderOperationsService);
    },
    async onTransitionStart(_from, to, data) {
        if (['Pending', 'Shipped', 'Delivered'].includes(to)) {
            for (const order of data.orders) {
                const error = await operations.shippingGate(data.ctx, order.id);
                if (error) return error;
            }
        }
    },
};

@VendurePlugin({
    imports: [PluginCommonModule],
    exports: [OrderOperationsService],
    compatibility: '^3.8.0',
    entities: operationsEntities,
    providers: [
        OrderOperationsService,
        ShopSocialService,
        ShopReportsService,
        ShopInvoiceService,
        ShopInventoryService,
    ],
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [OperationsShopResolver, OfflinePaymentQuoteResolver],
    },
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [OperationsAdminResolver],
    },
    dashboard: './dashboard/index.tsx',
    configuration: (config) => {
        config.shippingOptions.fulfillmentHandlers = (
            config.shippingOptions.fulfillmentHandlers || [
                manualFulfillmentHandler,
            ]
        ).map((handler) =>
            handler.code === 'manual-fulfillment'
                ? guardedManualHandler
                : handler,
        );
        config.orderOptions.process = [
            ...(config.orderOptions.process || [defaultOrderProcess]),
            orderGate,
        ];
        config.shippingOptions.process = [
            ...(config.shippingOptions.process || [defaultFulfillmentProcess]),
            fulfillmentGate,
        ];
        config.schedulerOptions.tasks = [
            ...(config.schedulerOptions.tasks || []),
            new ScheduledTask({
                id: 'shop-low-stock-scan',
                description: 'Check enabled channel stock alerts',
                schedule: (cron) => cron.everyHour(),
                execute: async ({injector}) =>
                    injector.get(ShopInventoryService).scheduledScan(),
            }),
        ];
        return config;
    },
})
export class ShopOperationsPlugin {}
