import {
    defaultPromotionActions,
    defaultPromotionConditions,
    LanguageCode,
    PluginCommonModule,
    PromotionCondition,
    PromotionOrderAction,
    ScheduledTask,
    VendurePlugin,
} from '@vendure/core';
import {ShopOperationsPlugin} from '../operations/operations.plugin';
import {growthEntities} from './entities';
import {GrowthCommon} from './common';
import {CatalogToolsService} from './catalog.service';
import {BundleService} from './bundles.service';
import {GrowthMailService} from './mail.service';
import {SchoolQuotesService} from './quotes.service';
import {ReturnsService} from './returns.service';
import {GrowthShopResolver, GrowthAdminResolver} from './resolvers';
import {growthAdminSchema, growthShopSchema} from './schema';
let bundles: BundleService;
const condition = new PromotionCondition({
    code: 'skillverse-complete-bundle',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Order contains a complete configured product bundle',
        },
    ],
    args: {},
    init(i) {
        bundles = i.get(BundleService);
    },
    check: (ctx, order) => bundles.discount(ctx, order).then((d) => d > 0),
});
const action = new PromotionOrderAction({
    code: 'skillverse-bundle-savings',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Apply configured bundle savings to component items',
        },
    ],
    args: {},
    conditions: [condition],
    init(i) {
        bundles = i.get(BundleService);
    },
    execute: async (ctx, order) => -(await bundles.discount(ctx, order)),
});
@VendurePlugin({
    imports: [PluginCommonModule, ShopOperationsPlugin],
    compatibility: '^3.8.0',
    entities: growthEntities,
    providers: [
        GrowthCommon,
        CatalogToolsService,
        BundleService,
        GrowthMailService,
        SchoolQuotesService,
        ReturnsService,
    ],
    shopApiExtensions: {
        schema: growthShopSchema,
        resolvers: [GrowthShopResolver],
    },
    adminApiExtensions: {
        schema: growthAdminSchema,
        resolvers: [GrowthAdminResolver],
    },
    dashboard: './dashboard/index.tsx',
    configuration: (config) => {
        config.customFields.OrderLine = [
            ...(config.customFields.OrderLine || []),
            {
                name: 'skillverseBundleKey',
                type: 'string',
                nullable: true,
                public: false,
                readonly: true,
            },
        ];
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ||
                defaultPromotionConditions),
            condition,
        ];
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ||
                defaultPromotionActions),
            action,
        ];
        config.schedulerOptions.tasks = [
            ...(config.schedulerOptions.tasks || []),
            new ScheduledTask({
                id: 'shop-customer-notifications',
                description:
                    'Send explicitly requested stock/cart reminders and clean private return-photo orphans',
                schedule: (cron) => cron.everyHour(),
                execute: async ({injector}) => {
                    await injector.get(ReturnsService).cleanup();
                    return injector.get(GrowthMailService).scan();
                },
            }),
        ];
        return config;
    },
})
export class ShopGrowthPlugin {}
