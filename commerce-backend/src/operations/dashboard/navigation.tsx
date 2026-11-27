import {
    BUILT_IN_NAV_ITEM_IDS,
    setNavVisibility,
    type NavMenuConfig,
    type DashboardUserContext,
} from '@vendure/dashboard';

function hasStoreTabs(ctx: DashboardUserContext) {
    return !!ctx.activeChannel &&
        ctx.activeChannel.code !== '__default_channel__' &&
        ctx.hasPermissions(['ManageStore', 'SellOwnProducts']);
}

/** Navigation only: native routes and API permissions remain unchanged. */
export function consolidateCommerceNavigation(config: NavMenuConfig): NavMenuConfig {
    const orders = setNavVisibility(
        config,
        { items: [BUILT_IN_NAV_ITEM_IDS.Orders] },
        // Every native order reader already has the Shop operations Orders tab.
        ctx => !ctx.hasPermissions(['ReadOrder', 'ManageStore', 'SellOwnProducts']),
    );
    const catalog = setNavVisibility(
        orders,
        { items: [
            BUILT_IN_NAV_ITEM_IDS.Products,
            BUILT_IN_NAV_ITEM_IDS.ProductVariants,
            BUILT_IN_NAV_ITEM_IDS.ShippingMethods,
        ] },
        // Preserve native tools for legacy roles without the replacement tabs,
        // and for global setup on Vendure's system/default channel.
        ctx => !hasStoreTabs(ctx),
    );
    return setNavVisibility(
        catalog,
        { items: [BUILT_IN_NAV_ITEM_IDS.PaymentMethods] },
        ctx => !(hasStoreTabs(ctx) && ctx.hasPermissions(['ManageStore'])),
    );
}
