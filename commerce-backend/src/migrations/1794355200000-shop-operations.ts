import {MigrationInterface, QueryRunner} from 'typeorm';

/** Additive only: existing Vendure orders, prices, payments and users are untouched. */
export class ShopOperations1794355200000 implements MigrationInterface {
    name = 'ShopOperations1794355200000';
    async up(queryRunner: QueryRunner): Promise<void> {
        const base =
            '`id` int NOT NULL AUTO_INCREMENT, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)';
        const tables = [
            [
                'sv_order_operations',
                `${base}, channelId int NOT NULL, orderId int NOT NULL, phoneStatus varchar(20) NOT NULL DEFAULT 'pending', callbackNotes text NULL, updatedByUserId int NULL, transferReference varchar(120) NULL, receiptFile varchar(80) NULL, receiptName varchar(180) NULL, receiptMime varchar(40) NULL, receiptStatus varchar(20) NOT NULL DEFAULT 'none', receiptReviewNote text NULL, version int NOT NULL DEFAULT 1, UNIQUE INDEX sv_order_operations_key (channelId,orderId), PRIMARY KEY(id)`,
            ],
            [
                'sv_merchant_settings',
                `${base}, channelId int NOT NULL, sellerName varchar(200) NOT NULL DEFAULT '', sellerAddress text NULL, sellerTaxId varchar(100) NOT NULL DEFAULT '', invoicePrefix varchar(20) NOT NULL DEFAULT 'SV', lowStockEnabled tinyint NOT NULL DEFAULT 0, lowStockThreshold int NOT NULL DEFAULT 5, notificationEmail varchar(254) NULL, UNIQUE INDEX sv_merchant_settings_key (channelId), PRIMARY KEY(id)`,
            ],
            [
                'sv_order_invoice',
                `${base}, channelId int NOT NULL, orderId int NOT NULL, number varchar(80) NOT NULL, snapshot longtext NOT NULL, UNIQUE INDEX sv_order_invoice_order_key(channelId,orderId), UNIQUE INDEX sv_order_invoice_number_key(channelId,number), PRIMARY KEY(id)`,
            ],
            [
                'sv_wishlist_item',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, productId int NOT NULL, UNIQUE INDEX sv_wishlist_key(channelId,customerId,productId), PRIMARY KEY(id)`,
            ],
            [
                'sv_product_review',
                `${base}, channelId int NOT NULL, customerId int NOT NULL, productId int NOT NULL, rating int NOT NULL, text text NOT NULL, authorName varchar(80) NOT NULL, status varchar(20) NOT NULL DEFAULT 'pending', version int NOT NULL DEFAULT 1, moderatedByUserId int NULL, UNIQUE INDEX sv_review_key(channelId,customerId,productId), INDEX sv_review_public_index(channelId,productId,status), PRIMARY KEY(id)`,
            ],
            [
                'sv_low_stock_notice',
                `${base}, channelId int NOT NULL, variantId int NOT NULL, alerted tinyint NOT NULL DEFAULT 0, UNIQUE INDEX sv_low_stock_notice_key(channelId,variantId), PRIMARY KEY(id)`,
            ],
        ];
        for (const [name, columns] of tables)
            await queryRunner.query(
                `CREATE TABLE \`${name}\` (${columns}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            );
    }
    async down(queryRunner: QueryRunner): Promise<void> {
        // Reverting intentionally removes the added feature data; never run as a routine deploy.
        for (const table of [
            'sv_low_stock_notice',
            'sv_product_review',
            'sv_wishlist_item',
            'sv_order_invoice',
            'sv_merchant_settings',
            'sv_order_operations',
        ]) {
            await queryRunner.query(`DROP TABLE \`${table}\``);
        }
    }
}
