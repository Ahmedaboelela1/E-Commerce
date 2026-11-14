import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketplaceAccess1794614400000 implements MigrationInterface {
    name = 'MarketplaceAccess1794614400000';
    async up(r: QueryRunner): Promise<void> {
        const base =
            'id int NOT NULL AUTO_INCREMENT, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY(id)';
        await r.query(
            `CREATE TABLE sv_marketplace_vendor (${base}, storeChannelId int NOT NULL, channelId int NOT NULL, sellerId int NOT NULL, stockLocationId int NOT NULL, userId int NOT NULL, code varchar(80) NOT NULL, name varchar(200) NOT NULL, active tinyint NOT NULL DEFAULT 1, version int NOT NULL DEFAULT 1, UNIQUE INDEX sv_vendor_code(storeChannelId,code), UNIQUE INDEX sv_vendor_channel(channelId), UNIQUE INDEX sv_vendor_user(userId)) ENGINE=InnoDB`,
        );
        await r.query(
            `CREATE TABLE sv_marketplace_shipping (${base}, storeChannelId int NOT NULL, vendorId int NOT NULL, shippingMethodId int NOT NULL, governorate varchar(60) NOT NULL, version int NOT NULL DEFAULT 1, UNIQUE INDEX sv_vendor_shipping_method(shippingMethodId), UNIQUE INDEX sv_vendor_governorate(vendorId,governorate), INDEX sv_vendor_shipping_vendor(storeChannelId,vendorId)) ENGINE=InnoDB`,
        );
        await r.query(
            'ALTER TABLE product ADD customFieldsMarketplaceownerid int NULL',
        );
        await r.query(
            `CREATE TABLE sv_marketplace_audit (${base}, storeChannelId int NOT NULL, actorUserId int NOT NULL, action varchar(80) NOT NULL, entityId int NULL, INDEX sv_marketplace_audit_store(storeChannelId,createdAt)) ENGINE=InnoDB`,
        );
    }
    async down(r: QueryRunner): Promise<void> {
        await r.query('DROP TABLE sv_marketplace_audit');
        await r.query(
            'ALTER TABLE product DROP COLUMN customFieldsMarketplaceownerid',
        );
        await r.query('DROP TABLE sv_marketplace_shipping');
        await r.query('DROP TABLE sv_marketplace_vendor');
    }
}
