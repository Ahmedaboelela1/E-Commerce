import 'dotenv/config';
import path from 'node:path';
import {
    DefaultJobQueuePlugin, DefaultSchedulerPlugin, DefaultSearchPlugin,
    VendureConfig, LanguageCode,
} from '@vendure/core';
import {AssetServerPlugin} from '@vendure/asset-server-plugin';
import {DashboardPlugin} from '@vendure/dashboard/plugin';

const IS_DEV = process.env.APP_ENV === 'dev';
const PORT = Number(process.env.PORT || 3000);
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(x => x.trim()).filter(Boolean) ?? [];

export const config: VendureConfig = {
    defaultLanguageCode: LanguageCode.en,
    apiOptions: {
        port: PORT,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        cors: {origin: IS_DEV ? true : corsOrigins, credentials: true},
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        requireVerification: true,
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME || '',
            password: process.env.SUPERADMIN_PASSWORD || '',
        },
        cookieOptions: {secret: process.env.COOKIE_SECRET || ''},
    },
    dbConnectionOptions: {
        type: 'mysql',
        synchronize: false,
        logging: false,
        migrations: [path.join(__dirname, 'migrations/*.+(js|ts)')],
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        username: process.env.DB_USERNAME || '',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'u169469823_store',
    },
    paymentOptions: {
        // No dummy payment provider and no real gateway until local merchant verification.
        paymentMethodHandlers: [],
    },
    customFields: {
        Product: [
            {name: 'supplierUrl', type: 'string', public: true, nullable: true},
            {name: 'manufacturer', type: 'string', public: true, nullable: true},
        ],
        ProductVariant: [
            {name: 'supplierSku', type: 'string', public: true, nullable: true},
            {name: 'availableOnOrder', type: 'boolean', public: true, defaultValue: false},
            {name: 'supplierLeadDays', type: 'int', public: true, nullable: true},
        ],
    },
    plugins: [
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({useDatabaseForBuffer: true}),
        DefaultSearchPlugin.init({bufferUpdates: false, indexStockStatus: true}),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(process.cwd(), 'static/assets'),
            assetUrlPrefix: process.env.ASSET_URL_PREFIX || undefined,
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(process.cwd(), 'dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
