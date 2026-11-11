import {VendureEntity} from '@vendure/core';
import {Column, Entity, Index} from 'typeorm';

@Entity('sv_growth_settings')
@Index('sv_growth_settings_channel', ['channelId'], {unique: true})
export class GrowthSettings extends VendureEntity {
    constructor(input?: Partial<GrowthSettings>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column({type: 'int', nullable: true}) bundlePromotionId: number | null;
    @Column({default: false}) returnsEnabled: boolean;
    @Column({default: 0}) returnWindowDays: number;
    @Column({default: true}) restockEnabled: boolean;
    @Column({default: false}) cartRemindersEnabled: boolean;
    @Column({default: 24}) reminderHours: number;
    @Column({default: 1}) version: number;
}

@Entity('sv_product_content')
@Index('sv_product_content_key', ['channelId', 'productId', 'languageCode'], {
    unique: true,
})
export class ProductContent extends VendureEntity {
    constructor(input?: Partial<ProductContent>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') productId: number;
    @Column({length: 10}) languageCode: string;
    @Column('longtext') content: string;
    @Column({default: 1}) version: number;
}

@Entity('sv_product_bundle')
@Index('sv_bundle_channel', ['channelId', 'enabled'])
export class ProductBundle extends VendureEntity {
    constructor(input?: Partial<ProductBundle>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column({length: 200}) name: string;
    @Column('text') description: string;
    @Column('longtext') components: string;
    @Column('int') price: number;
    @Column({default: false}) enabled: boolean;
    @Column({default: 0}) sortOrder: number;
    @Column({default: 1}) version: number;
}

@Entity('sv_stock_watch')
@Index('sv_stock_watch_key', ['channelId', 'customerId', 'variantId'], {
    unique: true,
})
export class StockWatch extends VendureEntity {
    constructor(input?: Partial<StockWatch>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column('int') variantId: number;
    @Column({default: false}) active: boolean;
    @Column({length: 64}) unsubscribeHash: string;
    @Column({type: 'datetime', precision: 6, nullable: true})
    notifiedAt: Date | null;
}

@Entity('sv_school_quote')
@Index('sv_quote_customer', ['channelId', 'customerId'])
@Index('sv_quote_order', ['orderId'], {unique: true})
export class SchoolQuote extends VendureEntity {
    constructor(input?: Partial<SchoolQuote>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column({length: 200}) organization: string;
    @Column({length: 30}) phone: string;
    @Column('text') notes: string;
    @Column('longtext') items: string;
    @Column({type: 'longtext', nullable: true}) address: string | null;
    @Column({type: 'longtext', nullable: true}) offer: string | null;
    @Column({length: 20, default: 'requested'}) status: string;
    @Column({type: 'int', nullable: true}) orderId: number | null;
    @Column({default: 1}) version: number;
}

@Entity('sv_return_case')
@Index('sv_return_customer', ['channelId', 'customerId'])
@Index('sv_return_order', ['channelId', 'orderId'])
@Index('sv_return_refund', ['refundId'], {unique: true})
export class ReturnCase extends VendureEntity {
    constructor(input?: Partial<ReturnCase>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column('int') orderId: number;
    @Column({length: 20}) kind: string;
    @Column('text') reason: string;
    @Column('longtext') items: string;
    @Column('longtext') photos: string;
    @Column({length: 20, default: 'requested'}) status: string;
    @Column({type: 'text', nullable: true}) publicMessage: string | null;
    @Column({type: 'text', nullable: true}) internalNotes: string | null;
    @Column({type: 'varchar', length: 20, nullable: true}) resolution:
        string | null;
    @Column({type: 'int', nullable: true}) refundId: number | null;
    @Column({type: 'int', nullable: true}) exchangeOrderId: number | null;
    @Column({default: 1}) version: number;
}

@Entity('sv_mail_preference')
@Index('sv_mail_preference_key', ['channelId', 'customerId'], {unique: true})
export class MailPreference extends VendureEntity {
    constructor(input?: Partial<MailPreference>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column({default: false}) cartReminderConsent: boolean;
    @Column({type: 'datetime', precision: 6, nullable: true})
    consentedAt: Date | null;
    @Column({length: 64}) unsubscribeHash: string;
}

@Entity('sv_cart_reminder')
@Index('sv_cart_reminder_key', ['channelId', 'orderId'], {unique: true})
@Index('sv_cart_reminder_token', ['tokenHash'], {unique: true})
export class CartReminder extends VendureEntity {
    constructor(input?: Partial<CartReminder>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') customerId: number;
    @Column('int') orderId: number;
    @Column({length: 64}) tokenHash: string;
    @Column({type: 'datetime', precision: 6}) expiresAt: Date;
    @Column({type: 'datetime', precision: 6, nullable: true})
    sentAt: Date | null;
}

@Entity('sv_cart_bundle')
@Index('sv_cart_bundle_key', ['groupKey'], {unique: true})
@Index('sv_cart_bundle_order', ['channelId', 'orderId'])
export class CartBundle extends VendureEntity {
    constructor(input?: Partial<CartBundle>) {
        super(input);
    }
    @Column('int') channelId: number;
    @Column('int') orderId: number;
    @Column('int') bundleId: number;
    @Column({length: 36}) groupKey: string;
    @Column('longtext') components: string;
    @Column('int') units: number;
}

declare module '@vendure/core/dist/entity/custom-entity-fields' {
    interface CustomOrderLineFields {
        skillverseBundleKey?: string | null;
    }
}

export const growthEntities = [
    GrowthSettings,
    ProductContent,
    ProductBundle,
    StockWatch,
    SchoolQuote,
    ReturnCase,
    MailPreference,
    CartReminder,
    CartBundle,
];
