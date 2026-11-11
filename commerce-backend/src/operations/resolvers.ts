import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    ID,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';
import {
    OrderOperationsService,
    ReceiptUpload,
} from './order-operations.service';
import {ShopSocialService} from './social.service';
import {ShopReportsService} from './reports.service';
import {ShopInvoiceService} from './invoice.service';
import {ShopInventoryService} from './inventory.service';

@Resolver()
export class OperationsShopResolver {
    constructor(
        private ops: OrderOperationsService,
        private social: ShopSocialService,
        private invoices: ShopInvoiceService,
    ) {}
    @Query()
    @Allow(Permission.Owner)
    myOrderOperations(@Ctx() ctx: RequestContext, @Args('orderId') id: ID) {
        return this.ops.publicOrder(ctx, id);
    }
    @Mutation()
    @Allow(Permission.Owner)
    @Transaction()
    submitTransferProof(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('reference') reference: string,
        @Args('file') file?: Promise<ReceiptUpload>,
    ) {
        return this.ops.submitProof(ctx, id, reference || '', file);
    }
    @Query()
    @Allow(Permission.Owner)
    myOrderInvoice(@Ctx() ctx: RequestContext, @Args('orderId') id: ID) {
        return this.invoices.download(ctx, id, true);
    }
    @Query()
    @Allow(Permission.Owner)
    myWishlistIds(@Ctx() ctx: RequestContext) {
        return this.social.wishlistIds(ctx);
    }
    @Query()
    @Allow(Permission.Owner)
    myWishlistProducts(@Ctx() ctx: RequestContext) {
        return this.social.wishlist(ctx);
    }
    @Mutation()
    @Allow(Permission.Owner)
    @Transaction()
    toggleWishlist(@Ctx() ctx: RequestContext, @Args('productId') id: ID) {
        return this.social.toggleWishlist(ctx, id);
    }
    @Query()
    @Allow(Permission.Public)
    productReviews(
        @Ctx() ctx: RequestContext,
        @Args('productId') id: ID,
        @Args('skip') skip?: number,
    ) {
        return this.social.publicReviews(ctx, id, skip || 0);
    }
    @Query()
    @Allow(Permission.Owner)
    myProductReview(@Ctx() ctx: RequestContext, @Args('productId') id: ID) {
        return this.social.myReview(ctx, id);
    }
    @Mutation()
    @Allow(Permission.Owner)
    @Transaction()
    submitProductReview(
        @Ctx() ctx: RequestContext,
        @Args('productId') id: ID,
        @Args('rating') rating: number,
        @Args('text') text: string,
    ) {
        return this.social.submitReview(ctx, id, rating, text);
    }
}

@Resolver()
export class OperationsAdminResolver {
    constructor(
        private ops: OrderOperationsService,
        private social: ShopSocialService,
        private reports: ShopReportsService,
        private invoices: ShopInvoiceService,
        private inventory: ShopInventoryService,
    ) {}
    @Query()
    @Allow(Permission.ReadSettings)
    shopOperationsSettings(@Ctx() ctx: RequestContext) {
        return this.ops.settings(ctx);
    }
    @Mutation()
    @Allow(Permission.UpdateSettings)
    @Transaction()
    saveShopOperationsSettings(
        @Ctx() ctx: RequestContext,
        @Args('input') input: Record<string, unknown>,
    ) {
        return this.ops.saveSettings(ctx, input);
    }
    @Query()
    @Allow(Permission.ReadOrder)
    shopOperationsOrders(
        @Ctx() ctx: RequestContext,
        @Args('search') search?: string,
        @Args('skip') skip?: number,
    ) {
        return this.ops.listOrders(ctx, search, skip);
    }
    @Query()
    @Allow(Permission.ReadOrder)
    shopOperationsOrder(@Ctx() ctx: RequestContext, @Args('orderId') id: ID) {
        return this.ops.adminOrder(ctx, id);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    updateOrderCallback(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('status') status: string,
        @Args('notes') notes: string,
        @Args('version') version: number,
    ) {
        return this.ops.updateCallback(ctx, id, status, notes, version);
    }
    @Query()
    @Allow(Permission.ReadOrder)
    shopTransferReceipt(@Ctx() ctx: RequestContext, @Args('orderId') id: ID) {
        return this.ops.receipt(ctx, id);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    verifyShopTransfer(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('reference') reference: string,
        @Args('confirmFundsReceived') confirmed: boolean,
    ) {
        return this.ops.verifyTransfer(ctx, id, reference, confirmed);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    rejectShopTransferProof(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('note') note: string,
    ) {
        return this.ops.rejectProof(ctx, id, note);
    }
    @Mutation()
    @Allow(Permission.UpdateOrder)
    @Transaction()
    dispatchShopOrder(
        @Ctx() ctx: RequestContext,
        @Args('orderId') id: ID,
        @Args('carrier') carrier: string,
        @Args('trackingCode') code: string,
    ) {
        return this.ops.dispatch(ctx, id, carrier, code);
    }
    @Query()
    @Allow(Permission.ReadOrder)
    shopOrderInvoice(@Ctx() ctx: RequestContext, @Args('orderId') id: ID) {
        return this.invoices.download(ctx, id, false);
    }
    @Query()
    @Allow(Permission.ReadOrder)
    shopSalesReport(
        @Ctx() ctx: RequestContext,
        @Args('from') from: string,
        @Args('to') to: string,
    ) {
        return this.reports.report(ctx, from, to);
    }
    @Mutation()
    @Allow(Permission.CreatePromotion)
    @Transaction()
    createShopCoupon(
        @Ctx() ctx: RequestContext,
        @Args('input') input: Record<string, unknown>,
    ) {
        return this.reports.createCoupon(ctx, input);
    }
    @Query()
    @Allow(Permission.ReadCatalog)
    shopOperationsInventory(
        @Ctx() ctx: RequestContext,
        @Args('skip') skip?: number,
    ) {
        return this.inventory.inventory(ctx, skip);
    }
    @Mutation()
    @Allow(Permission.UpdateCatalog)
    checkShopLowStock(@Ctx() ctx: RequestContext) {
        return this.inventory.scan(ctx);
    }
    @Query()
    @Allow(Permission.ReadCatalog)
    shopProductReviews(
        @Ctx() ctx: RequestContext,
        @Args('status') status?: string,
        @Args('skip') skip?: number,
    ) {
        return this.social.adminReviews(ctx, status, skip);
    }
    @Mutation()
    @Allow(Permission.UpdateCatalog)
    @Transaction()
    moderateShopReview(
        @Ctx() ctx: RequestContext,
        @Args('reviewId') id: ID,
        @Args('status') status: string,
        @Args('version') version: number,
    ) {
        return this.social.moderate(ctx, id, status, version);
    }
}
