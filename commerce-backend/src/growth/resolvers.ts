import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Permission,
    ForbiddenError,
    RequestContext,
    Transaction,
} from '@vendure/core';
import {CatalogToolsService} from './catalog.service';
import {BundleService} from './bundles.service';
import {GrowthMailService} from './mail.service';
import {GrowthCommon} from './common';
import {SchoolQuotesService} from './quotes.service';
import {ReturnsService} from './returns.service';
import type {ReceiptUpload} from '../operations/order-operations.service';

@Resolver()
export class GrowthShopResolver {
    constructor(
        private common: GrowthCommon,
        private catalog: CatalogToolsService,
        private bundles: BundleService,
        private mail: GrowthMailService,
        private quotes: SchoolQuotesService,
        private returns: ReturnsService,
    ) {}
    @Query() @Allow(Permission.Public) shopVariantAvailability(
        @Ctx() c: RequestContext,
        @Args('variantId') id: ID,
    ) {
        return this.catalog.availability(c, id);
    }
    @Query() @Allow(Permission.Public) shopProductContent(
        @Ctx() c: RequestContext,
        @Args('productId') id: ID,
    ) {
        return this.catalog.content(c, id);
    }
    @Query() @Allow(Permission.Public) compareShopProducts(
        @Ctx() c: RequestContext,
        @Args('productIds') ids: ID[],
    ) {
        return this.catalog.compare(c, ids);
    }
    @Query() @Allow(Permission.Public) shopBundles(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.bundles.list(c, false, skip);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() addShopBundle(
        @Ctx() c: RequestContext,
        @Args('bundleId') id: ID,
        @Args('quantity') q: number,
    ) {
        return this.bundles.add(c, id, q);
    }
    @Query() @Allow(Permission.Owner) myStockWatches(@Ctx() c: RequestContext) {
        return this.mail.watches(c);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() setShopStockWatch(
        @Ctx() c: RequestContext,
        @Args('variantId') id: ID,
        @Args('active') active: boolean,
    ) {
        return this.mail.watch(c, id, active);
    }
    @Query() @Allow(Permission.Owner) myShopMailPreference(
        @Ctx() c: RequestContext,
    ) {
        return this.mail.preferences(c);
    }
    @Mutation()
    @Allow(Permission.Owner)
    @Transaction()
    setShopCartReminderConsent(
        @Ctx() c: RequestContext,
        @Args('consent') consent: boolean,
    ) {
        return this.mail.setPreference(c, consent);
    }
    @Mutation() @Allow(Permission.Public) @Transaction() unsubscribeShopMail(
        @Ctx() c: RequestContext,
        @Args('kind') kind: string,
        @Args('id') id: ID,
        @Args('token') token: string,
    ) {
        return this.mail.unsubscribe(c, kind, id, token);
    }
    @Query() @Allow(Permission.Owner) myRecoveryCart(
        @Ctx() c: RequestContext,
        @Args('token') token: string,
    ) {
        return this.mail.recovery(c, token);
    }
    @Query() @Allow(Permission.Owner) mySchoolQuotes(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.quotes.list(c, false, skip);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() requestSchoolQuote(
        @Ctx() c: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.quotes.request(c, input);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() respondToSchoolQuote(
        @Ctx() c: RequestContext,
        @Args('quoteId') id: ID,
        @Args('accept') accept: boolean,
        @Args('version') v: number,
    ) {
        return this.quotes.respond(c, id, accept, v);
    }
    @Query() @Allow(Permission.Owner) myReturnRequests(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.returns.list(c, false, skip);
    }
    @Query() @Allow(Permission.Owner) myReturnEligibility(
        @Ctx() c: RequestContext,
        @Args('orderId') id: ID,
    ) {
        return this.returns.eligibility(c, id);
    }
    @Query() @Allow(Permission.Owner) myReturnPhoto(
        @Ctx() c: RequestContext,
        @Args('returnId') id: ID,
        @Args('index') i: number,
    ) {
        return this.returns.photo(c, id, i, true);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() requestShopReturn(
        @Ctx() c: RequestContext,
        @Args('orderId') id: ID,
        @Args('input') input: unknown,
    ) {
        return this.returns.request(c, id, input);
    }
    @Mutation() @Allow(Permission.Owner) @Transaction() uploadShopReturnPhoto(
        @Ctx() c: RequestContext,
        @Args('returnId') id: ID,
        @Args('file') f: Promise<ReceiptUpload>,
    ) {
        return this.returns.upload(c, id, f);
    }
    @Query() @Allow(Permission.Public) async shopGrowthFeatures(
        @Ctx() c: RequestContext,
    ) {
        const s = await this.common.settings(c);
        return {
            returnsEnabled: s.returnsEnabled,
            returnWindowDays: s.returnWindowDays,
            restockEnabled: s.restockEnabled,
            cartReminderOptInAvailable: s.cartRemindersEnabled,
        };
    }
}

@Resolver()
export class GrowthAdminResolver {
    constructor(
        private common: GrowthCommon,
        private catalog: CatalogToolsService,
        private bundles: BundleService,
        private mail: GrowthMailService,
        private quotes: SchoolQuotesService,
        private returns: ReturnsService,
    ) {}
    @Query() @Allow(Permission.ReadSettings) shopGrowthSettings(
        @Ctx() c: RequestContext,
    ) {
        return this.common.settings(c);
    }
    @Mutation()
    @Allow(Permission.UpdateSettings)
    @Transaction()
    saveShopGrowthSettings(
        @Ctx() c: RequestContext,
        @Args('input') input: unknown,
    ) {
        return this.common.saveSettings(c, input);
    }
    @Query() @Allow(Permission.ReadCatalog) shopCatalogContent(
        @Ctx() c: RequestContext,
        @Args('productId') id: ID,
        @Args('languageCode') language?: string,
    ) {
        return this.catalog.content(c, id, language, false, false);
    }
    @Mutation()
    @Allow(Permission.UpdateCatalog)
    @Transaction()
    saveShopProductContent(
        @Ctx() c: RequestContext,
        @Args('productId') id: ID,
        @Args('languageCode') language: string,
        @Args('input') input: unknown,
        @Args('version') v: number,
    ) {
        return this.catalog.save(c, id, language, input, v);
    }
    @Query() @Allow(Permission.ReadCatalog) shopAdminBundles(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.bundles.list(c, true, skip);
    }
    @Mutation() @Allow(Permission.UpdateCatalog) @Transaction() saveShopBundle(
        @Ctx() c: RequestContext,
        @Args('input') input: unknown,
    ) {
        if (!c.userHasPermissions([Permission.CreatePromotion]))
            throw new ForbiddenError();
        return this.bundles.save(c, input);
    }
    @Query() @Allow(Permission.ReadOrder) shopSchoolQuotes(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.quotes.list(c, true, skip);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    publishSchoolQuote(
        @Ctx() c: RequestContext,
        @Args('quoteId') id: ID,
        @Args('input') input: unknown,
        @Args('version') v: number,
        @Args('publish') publish: boolean,
    ) {
        return this.quotes.offer(c, id, input, v, publish);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    linkSchoolQuoteOrder(
        @Ctx() c: RequestContext,
        @Args('quoteId') id: ID,
        @Args('orderId') order: ID,
        @Args('version') v: number,
    ) {
        return this.quotes.linkOrder(c, id, order, v);
    }
    @Query() @Allow(Permission.ReadOrder) shopReturnRequests(
        @Ctx() c: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.returns.list(c, true, skip);
    }
    @Query() @Allow(Permission.ReadOrder) shopReturnPhoto(
        @Ctx() c: RequestContext,
        @Args('returnId') id: ID,
        @Args('index') i: number,
    ) {
        return this.returns.photo(c, id, i, false);
    }
    @Mutation() @Allow(Permission.UpdateOrder) @Transaction() updateShopReturn(
        @Ctx() c: RequestContext,
        @Args('returnId') id: ID,
        @Args('input') input: unknown,
        @Args('version') v: number,
    ) {
        return this.returns.update(c, id, input, v);
    }
    @Mutation()
    @Allow(Permission.UpdateSettings)
    async runShopCustomerNotifications(@Ctx() c: RequestContext) {
        const watches = await this.mail.watchesForChannel(c);
        let stock = 0;
        for (const id of watches) stock += await this.mail.notifyStock(c, id);
        return {
            stockNotifications: stock,
            cartReminders: await this.mail.remindCarts(c),
        };
    }
}
