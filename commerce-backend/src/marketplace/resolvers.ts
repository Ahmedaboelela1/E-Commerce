import {
    Args,
    Mutation,
    Query,
    Resolver,
    ResolveField,
    Parent,
} from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    Permission,
    RequestContext,
    ID,
    Transaction,
    AssetService,
} from '@vendure/core';
import { MarketplaceAccessService } from './access.service';
import { MarketplaceAccountsService } from './accounts.service';
import { MarketplaceCatalogService } from './catalog.service';
import { MarketplaceOrdersService } from './orders.service';
import { MarketplaceShippingService } from './shipping.service';
import { MarketplacePaymentsService } from './payments.service';
import { ManageStore, SellOwnProducts } from './permissions';

@Resolver()
export class MarketplaceAdminResolver {
    constructor(
        private access: MarketplaceAccessService,
        private accounts: MarketplaceAccountsService,
        private catalog: MarketplaceCatalogService,
        private orders: MarketplaceOrdersService,
        private shipping: MarketplaceShippingService,
        private payments: MarketplacePaymentsService,
    ) {}
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    async marketplaceAccess(@Ctx() ctx: RequestContext) {
        const a = await this.access.actor(ctx);
        return {
            kind: a.kind,
            storeName: a.store.channel.code,
            storeId: a.store.channelId,
            currencyCode: a.store.currencyCode,
            pricesIncludeTax: a.store.channel.pricesIncludeTax,
            sellerId: a.vendor?.id || null,
            sellerName: a.vendor?.name || null,
            superAdmin: a.superAdmin,
        };
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceVendors(@Ctx() ctx: RequestContext) {
        return this.accounts.vendors(ctx);
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceProducts(
        @Ctx() ctx: RequestContext,
        @Args('search') search?: string,
        @Args('skip') skip?: number,
    ) {
        return this.catalog.list(ctx, search, skip);
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceProduct(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.catalog.detail(ctx, id);
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceOrders(@Ctx() ctx: RequestContext, @Args('skip') skip?: number) {
        return this.orders.list(ctx, skip);
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceOrder(@Ctx() ctx: RequestContext, @Args('id') id: ID) {
        return this.orders.detail(ctx, id);
    }
    @Query()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    marketplaceDeliveryRates(@Ctx() ctx: RequestContext) {
        return this.shipping.list(ctx);
    }
    @Query()
    @Allow(ManageStore.Permission)
    marketplacePaymentMethods(@Ctx() ctx: RequestContext) {
        return this.payments.list(ctx);
    }
    @Mutation()
    @Allow(Permission.SuperAdmin)
    createStoreAdmin(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.accounts.create(ctx, input, 'admin');
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    createStoreSeller(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.accounts.create(ctx, input, 'seller');
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    setStoreSellerActive(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.accounts.setActive(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    saveMarketplaceProduct(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.catalog.save(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    uploadMarketplaceImage(
        @Ctx() ctx: RequestContext,
        @Args('file') file: Parameters<AssetService['create']>[1]['file'],
        @Args('vendorId') vendorId?: ID,
    ) {
        return this.catalog.upload(ctx, file, vendorId);
    }
    @Mutation()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    saveMarketplaceDeliveryRate(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.shipping.save(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    saveMarketplacePaymentMethod(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.payments.save(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    dispatchMarketplaceItems(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.orders.dispatch(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission, SellOwnProducts.Permission)
    transitionMarketplaceShipment(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('state') state: string,
    ) {
        return this.orders.transition(ctx, id, state);
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    cancelStoreOrder(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.orders.cancel(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    refundStoreOrder(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.orders.refund(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    settleStoreRefund(
        @Ctx() ctx: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.orders.settleRefund(ctx, input);
    }
    @Mutation()
    @Allow(ManageStore.Permission)
    @Transaction()
    confirmStoreCashReceipt(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('confirmed') confirmed: boolean,
        @Args('reference') reference: string,
    ) {
        return this.payments.collectCod(ctx, id, confirmed, reference);
    }
}

@Resolver()
export class MarketplaceDeliveryResolver {
    constructor(private shipping: MarketplaceShippingService) {}
    @Query()
    @Allow(Permission.Owner)
    marketplaceDeliveryGroups(@Ctx() ctx: RequestContext) {
        return this.shipping.requiredGroups(ctx);
    }
    @Mutation()
    @Allow(Permission.Owner)
    setMarketplaceDelivery(
        @Ctx() ctx: RequestContext,
        @Args('shippingMethodIds') ids: ID[],
    ) {
        return this.shipping.setForActiveOrder(ctx, ids);
    }
}

@Resolver('ShippingMethodQuote')
export class MarketplaceShippingQuoteResolver {
    constructor(private shipping: MarketplaceShippingService) {}
    @ResolveField()
    @Allow(Permission.Owner)
    async deliveryGroup(
        @Ctx() ctx: RequestContext,
        @Parent() quote: { id: ID },
    ) {
        return (await this.shipping.group(ctx, quote.id)).id;
    }
    @ResolveField()
    @Allow(Permission.Owner)
    async sellerName(@Ctx() ctx: RequestContext, @Parent() quote: { id: ID }) {
        return (await this.shipping.group(ctx, quote.id)).name;
    }
}
