import {
    DefaultOrderSellerStrategy,
    OrderLine,
    OrderProcess,
    PluginCommonModule,
    Injector,
    RequestContext,
    ShippingEligibilityChecker,
    VendurePlugin,
} from '@vendure/core';
import { MarketplaceAccessService } from './access.service';
import { MarketplaceAccountsService } from './accounts.service';
import { MarketplaceCatalogService } from './catalog.service';
import { MarketplaceOrdersService } from './orders.service';
import { MarketplacePaymentsService } from './payments.service';
import { MarketplaceShippingService } from './shipping.service';
import {
    MarketplaceAudit,
    MarketplaceShipping,
    MarketplaceVendor,
} from './entities';
import { ManageStore, SellOwnProducts } from './permissions';
import {
    MarketplaceAdminResolver,
    MarketplaceDeliveryResolver,
    MarketplaceShippingQuoteResolver,
} from './resolvers';
import { marketplaceAdminSchema, marketplaceShopSchema } from './schema';
import { ShopOperationsPlugin } from '../operations/operations.plugin';
import { egyptGovernorates } from '../egypt-governorate-shipping';
import { LanguageCode } from '@vendure/core';

let shipping: MarketplaceShippingService;
class SellerLineOwnerStrategy extends DefaultOrderSellerStrategy {
    init(injector: Injector) {
        shipping = injector.get(MarketplaceShippingService);
    }
    async setOrderLineSellerChannel(ctx: RequestContext, line: OrderLine) {
        const channel = await shipping.lineOwner(ctx, line);
        if (channel) line.sellerChannelId = channel.id;
        return channel;
    }
    // Keep the native customer order and its payment/invoice intact. Seller views
    // project immutable line ownership rather than duplicating financial orders.
}

const sellerDeliveryChecker = new ShippingEligibilityChecker({
    code: 'marketplace-seller-governorate',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Seller delivery by governorate / توصيل البائع حسب المحافظة',
        },
    ],
    args: {
        vendorId: { type: 'int', min: 1 },
        governorate: {
            type: 'string',
            ui: {
                component: 'select-form-input',
                options: egyptGovernorates.map(([value, en, ar]) => ({
                    value,
                    label: [
                        {
                            languageCode: LanguageCode.en,
                            value: `${ar} / ${en}`,
                        },
                        {
                            languageCode: LanguageCode.ar,
                            value: `${ar} / ${en}`,
                        },
                    ],
                })),
            },
        },
    },
    init(injector) {
        shipping = injector.get(MarketplaceShippingService);
    },
    check: (ctx, order, args) =>
        shipping.eligible(ctx, order, args.vendorId, args.governorate),
});
const deliveryGuard: OrderProcess<never> = {
    init(injector) {
        shipping = injector.get(MarketplaceShippingService);
    },
    async onTransitionStart(_from, to, { ctx, order }) {
        if (
            to === 'ArrangingPayment' ||
            (order.active &&
                ['PaymentAuthorized', 'PaymentSettled'].includes(to))
        )
            return shipping.validate(ctx, order);
    },
};

@VendurePlugin({
    imports: [PluginCommonModule, ShopOperationsPlugin],
    compatibility: '^3.8.0',
    entities: [MarketplaceVendor, MarketplaceShipping, MarketplaceAudit],
    providers: [
        MarketplaceAccessService,
        MarketplaceAccountsService,
        MarketplaceCatalogService,
        MarketplaceOrdersService,
        MarketplacePaymentsService,
        MarketplaceShippingService,
    ],
    adminApiExtensions: {
        schema: marketplaceAdminSchema,
        resolvers: [MarketplaceAdminResolver],
    },
    shopApiExtensions: {
        schema: marketplaceShopSchema,
        resolvers: [
            MarketplaceDeliveryResolver,
            MarketplaceShippingQuoteResolver,
        ],
    },
    dashboard: './dashboard/index.tsx',
    configuration: (config) => {
        config.authOptions.customPermissions.push(ManageStore, SellOwnProducts);
        config.customFields.Product.push({
            name: 'marketplaceOwnerId',
            type: 'int',
            nullable: true,
            public: false,
            internal: true,
        });
        config.orderOptions.orderSellerStrategy = new SellerLineOwnerStrategy();
        config.orderOptions.process = [
            ...(config.orderOptions.process || []),
            deliveryGuard,
        ];
        config.shippingOptions.shippingLineAssignmentStrategy = {
            init(injector) {
                shipping = injector.get(MarketplaceShippingService);
            },
            assignShippingLineToOrderLines: (ctx, line, order) =>
                shipping.assign(ctx, line, order),
        };
        for (const checker of config.shippingOptions
            .shippingEligibilityCheckers || []) {
            const original = checker.check.bind(checker);
            checker.check = (ctx, order, args, method) =>
                order.lines.some((line) => line.sellerChannelId == null)
                    ? original(ctx, order, args, method)
                    : Promise.resolve(false);
        }
        config.shippingOptions.shippingEligibilityCheckers.push(
            sellerDeliveryChecker,
        );
        return config;
    },
})
export class MarketplacePlugin {}
