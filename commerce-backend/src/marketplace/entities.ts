import { VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('sv_marketplace_vendor')
@Index('sv_vendor_code', ['storeChannelId', 'code'], { unique: true })
@Index('sv_vendor_channel', ['channelId'], { unique: true })
@Index('sv_vendor_user', ['userId'], { unique: true })
export class MarketplaceVendor extends VendureEntity {
    constructor(input?: Partial<MarketplaceVendor>) {
        super(input);
    }
    @Column('int') storeChannelId: number;
    @Column('int') channelId: number;
    @Column('int') sellerId: number;
    @Column('int') stockLocationId: number;
    @Column('int') userId: number;
    @Column({ length: 80 }) code: string;
    @Column({ length: 200 }) name: string;
    @Column({ default: true }) active: boolean;
    @Column({ default: 1 }) version: number;
}

@Entity('sv_marketplace_shipping')
@Index('sv_vendor_governorate', ['vendorId', 'governorate'], { unique: true })
@Index('sv_vendor_shipping_method', ['shippingMethodId'], { unique: true })
export class MarketplaceShipping extends VendureEntity {
    constructor(input?: Partial<MarketplaceShipping>) {
        super(input);
    }
    @Column('int') storeChannelId: number;
    @Column('int') vendorId: number;
    @Column('int') shippingMethodId: number;
    @Column({ length: 60 }) governorate: string;
    @Column({ default: 1 }) version: number;
}

@Entity('sv_marketplace_audit')
@Index('sv_marketplace_audit_store', ['storeChannelId', 'createdAt'])
export class MarketplaceAudit extends VendureEntity {
    constructor(input?: Partial<MarketplaceAudit>) {
        super(input);
    }
    @Column('int') storeChannelId: number;
    @Column('int') actorUserId: number;
    @Column({ length: 80 }) action: string;
    @Column({ type: 'int', nullable: true }) entityId: number | null;
}

declare module '@vendure/core/dist/entity/custom-entity-fields' {
    interface CustomProductFields {
        marketplaceOwnerId?: number | null;
    }
}
