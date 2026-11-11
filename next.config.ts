import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/site/i18n/request.ts');

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {serverActions: {bodySizeLimit: '8mb'}},
    images: {
        // This is necessary to display images from your local Vendure instance
        dangerouslyAllowLocalIP: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'api.skillverse-global.com',
                pathname: '/assets/**',
            },
            {
                hostname: 'readonlydemo.vendure.io',
            },
            {
                hostname: 'demo.vendure.io'
            },
            {
                hostname: 'localhost'
            }
        ],
    }
};

export default withNextIntl(nextConfig);
