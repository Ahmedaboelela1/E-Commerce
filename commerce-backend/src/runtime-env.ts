import 'dotenv/config';

const mandatory = [
    'DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD',
    'SUPERADMIN_USERNAME', 'SUPERADMIN_PASSWORD', 'COOKIE_SECRET',
] as const;

export function assertRuntimeEnvironment(): void {
    const missing = mandatory.filter(key => {
        const value = process.env[key]?.trim();
        return !value || value.startsWith('REPLACE_');
    });
    if (missing.length) {
        throw new Error('Missing required server environment variables: ' + missing.join(', '));
    }
    if (process.env.SUPERADMIN_PASSWORD!.length < 20 || process.env.COOKIE_SECRET!.length < 32) {
        throw new Error('Use a random superadmin password (20+ characters) and cookie secret (32+ characters).');
    }
    if (process.env.APP_ENV !== 'dev') {
        for (const key of ['BACKEND_PUBLIC_URL', 'STOREFRONT_PUBLIC_URL', 'ASSET_URL_PREFIX']) {
            if (!process.env[key]?.startsWith('https://')) {
                throw new Error(key + ' must be a real HTTPS URL in production.');
            }
        }
        if (!process.env.CORS_ORIGINS?.trim()) throw new Error('CORS_ORIGINS required in production.');
    }
}
