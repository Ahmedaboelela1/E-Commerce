import {VendureEntity} from '@vendure/core';
import {Column, Entity, Index} from 'typeorm';

@Entity('sv_order_operations')
@Index('sv_order_operations_key', ['channelId', 'orderId'], {unique: true})
export class OrderOperations extends VendureEntity {
    constructor(input?: Partial<OrderOperations>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') orderId: number;
    @Column({default: 'pending', length: 20}) phoneStatus: string;
    @Column({type: 'text', nullable: true}) callbackNotes: string | null;
    @Column({type: 'int', nullable: true}) updatedByUserId: number | null;
    @Column({type: 'varchar', length: 120, nullable: true}) transferReference:
        string | null;
    @Column({type: 'varchar', length: 80, nullable: true}) receiptFile:
        string | null;
    @Column({type: 'varchar', length: 180, nullable: true}) receiptName:
        string | null;
    @Column({type: 'varchar', length: 40, nullable: true}) receiptMime:
        string | null;
    @Column({default: 'none', length: 20}) receiptStatus: string;
    @Column({type: 'text', nullable: true}) receiptReviewNote: string | null;
    @Column({default: 1}) version: number;
}

@Entity('sv_merchant_settings')
@Index('sv_merchant_settings_key', ['channelId'], {unique: true})
export class MerchantSettings extends VendureEntity {
    constructor(input?: Partial<MerchantSettings>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column({default: '', length: 200}) sellerName: string;
    @Column({type: 'text', nullable: true}) sellerAddress: string | null;
    @Column({default: '', length: 100}) sellerTaxId: string;
    @Column({default: 'SV', length: 20}) invoicePrefix: string;
    @Column({default: false}) lowStockEnabled: boolean;
    @Column({default: 5}) lowStockThreshold: number;
    @Column({type: 'varchar', length: 254, nullable: true}) notificationEmail:
        string | null;
}

@Entity('sv_order_invoice')
@Index('sv_order_invoice_order_key', ['channelId', 'orderId'], {unique: true})
@Index('sv_order_invoice_number_key', ['channelId', 'number'], {unique: true})
export class OrderInvoice extends VendureEntity {
    constructor(input?: Partial<OrderInvoice>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') orderId: number;
    @Column({length: 80}) number: string;
    @Column('longtext') snapshot: string;
}

@Entity('sv_wishlist_item')
@Index('sv_wishlist_key', ['channelId', 'customerId', 'productId'], {
    unique: true,
})
export class WishlistItem extends VendureEntity {
    constructor(input?: Partial<WishlistItem>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column('int') productId: number;
}

@Entity('sv_product_review')
@Index('sv_review_key', ['channelId', 'customerId', 'productId'], {
    unique: true,
})
@Index('sv_review_public_index', ['channelId', 'productId', 'status'])
export class ProductReview extends VendureEntity {
    constructor(input?: Partial<ProductReview>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column('int') productId: number;
    @Column('int') rating: number;
    @Column('text') text: string;
    @Column({length: 80}) authorName: string;
    @Column({default: 'pending', length: 20}) status: string;
    @Column({default: 1}) version: number;
    @Column({type: 'int', nullable: true}) moderatedByUserId: number | null;
}

@Entity('sv_low_stock_notice')
@Index('sv_low_stock_notice_key', ['channelId', 'variantId'], {unique: true})
export class LowStockNotice extends VendureEntity {
    constructor(input?: Partial<LowStockNotice>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') variantId: number;
    @Column({default: false}) alerted: boolean;
}

export const operationsEntities = [
    OrderOperations,
    MerchantSettings,
    OrderInvoice,
    WishlistItem,
    ProductReview,
    LowStockNotice,
];
