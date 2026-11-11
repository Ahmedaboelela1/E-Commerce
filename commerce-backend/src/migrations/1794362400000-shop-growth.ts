import {MigrationInterface, QueryRunner} from 'typeorm';

export class ShopGrowth1794362400000 implements MigrationInterface {
    name = 'ShopGrowth1794362400000';
    async up(r: QueryRunner): Promise<void> {
        const base =
            'id int NOT NULL AUTO_INCREMENT, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)';
        const tables = [
            [
                'sv_growth_settings',
                `${base}, channelId int NOT NULL, bundlePromotionId int NULL, returnsEnabled tinyint NOT NULL DEFAULT 0, returnWindowDays int NOT NULL DEFAULT 0, restockEnabled tinyint NOT NULL DEFAULT 1, cartRemindersEnabled tinyint NOT NULL DEFAULT 0, reminderHours int NOT NULL DEFAULT 24, version int NOT NULL DEFAULT 1, UNIQUE INDEX sv_growth_settings_channel(channelId)`,
            ],
            [
                'sv_product_content',
                `${base}, channelId int NOT NULL, productId int NOT NULL, languageCode varchar(10) NOT NULL, content longtext NOT NULL, version int NOT NULL DEFAULT 1, UNIQUE INDEX sv_product_content_key(channelId,productId,languageCode)`,
            ],
            [
                'sv_product_bundle',
                `${base}, channelId int NOT NULL, name varchar(200) NOT NULL, description text NOT NULL, components longtext NOT NULL, price int NOT NULL, enabled tinyint NOT NULL DEFAULT 0, sortOrder int NOT NULL DEFAULT 0, version int NOT NULL DEFAULT 1, INDEX sv_bundle_channel(channelId,enabled)`,
            ],
            [
                'sv_stock_watch',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, variantId int NOT NULL, active tinyint NOT NULL DEFAULT 0, unsubscribeHash varchar(64) NOT NULL, notifiedAt datetime(6) NULL, UNIQUE INDEX sv_stock_watch_key(channelId,customerId,variantId)`,
            ],
            [
                'sv_school_quote',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, organization varchar(200) NOT NULL, phone varchar(30) NOT NULL, notes text NOT NULL, items longtext NOT NULL, address longtext NULL, offer longtext NULL, status varchar(20) NOT NULL DEFAULT 'requested', orderId int NULL, version int NOT NULL DEFAULT 1, INDEX sv_quote_customer(channelId,customerId), UNIQUE INDEX sv_quote_order(orderId)`,
            ],
            [
                'sv_return_case',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, orderId int NOT NULL, kind varchar(20) NOT NULL, reason text NOT NULL, items longtext NOT NULL, photos longtext NOT NULL, status varchar(20) NOT NULL DEFAULT 'requested', publicMessage text NULL, internalNotes text NULL, resolution varchar(20) NULL, refundId int NULL, exchangeOrderId int NULL, version int NOT NULL DEFAULT 1, INDEX sv_return_customer(channelId,customerId), INDEX sv_return_order(channelId,orderId), UNIQUE INDEX sv_return_refund(refundId)`,
            ],
            [
                'sv_mail_preference',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, cartReminderConsent tinyint NOT NULL DEFAULT 0, consentedAt datetime(6) NULL, unsubscribeHash varchar(64) NOT NULL, UNIQUE INDEX sv_mail_preference_key(channelId,customerId)`,
            ],
            [
                'sv_cart_bundle',
                `${base}, channelId int NOT NULL, orderId int NOT NULL, bundleId int NOT NULL, groupKey varchar(36) NOT NULL, components longtext NOT NULL, units int NOT NULL, UNIQUE INDEX sv_cart_bundle_key(groupKey), INDEX sv_cart_bundle_order(channelId,orderId)`,
            ],
            [
                'sv_cart_reminder',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, orderId int NOT NULL, tokenHash varchar(64) NOT NULL, expiresAt datetime(6) NOT NULL, sentAt datetime(6) NULL, UNIQUE INDEX sv_cart_reminder_key(channelId,orderId), UNIQUE INDEX sv_cart_reminder_token(tokenHash)`,
            ],
        ];
        for (const [name, columns] of tables)
            await r.query(
                `CREATE TABLE \`${name}\` (${columns}, PRIMARY KEY(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            );
        await r.query(
            'ALTER TABLE `order_line` ADD `customFieldsSkillversebundlekey` varchar(255) NULL',
        );
    }
    async down(r: QueryRunner): Promise<void> {
        for (const name of [
            'sv_cart_bundle',
            'sv_cart_reminder',
            'sv_mail_preference',
            'sv_return_case',
            'sv_school_quote',
            'sv_stock_watch',
            'sv_product_bundle',
            'sv_product_content',
            'sv_growth_settings',
        ])
            await r.query(`DROP TABLE \`${name}\``);
        await r.query(
            'ALTER TABLE `order_line` DROP COLUMN `customFieldsSkillversebundlekey`',
        );
    }
}
