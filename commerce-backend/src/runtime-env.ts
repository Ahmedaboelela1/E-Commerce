import 'dotenv/config';

const mandatory = [
    'DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD',
    'SUPERADMIN_USERNAME', 'SUPERADMIN_PASSWORD', 'COOKIE_SECRET',
] as const;

export function assertRuntimeEnvironment(): void {
    const missing = mandatory.filter(key => {
        const value = process.env[key]?.trim();
        return !value || /^(?:REPLACE_|YOUR_|<)/i.test(value);
    });
    if (missing.length) {
        throw new Error('Missing required server environment variables: ' + missing.join(', '));
    }
    if (process.env.SUPERADMIN_PASSWORD!.length < 20 || process.env.COOKIE_SECRET!.length < 32) {
        throw new Error('Use a random superadmin password (20+ characters) and cookie secret (32+ characters).');
    }
    if (process.env.APP_ENV !== 'dev') {
        for (const key of ['BACKEND_PUBLIC_URL', 'STOREFRONT_PUBLIC_URL', 'ASSET_URL_PREFIX']) {
            if (!process.env[key]?.startsWith('https://') || /YOUR-|example\b/i.test(process.env[key]!)) {
                throw new Error(key + ' must be a real HTTPS URL in production.');
            }
        }
        if (!process.env.CORS_ORIGINS?.trim()) throw new Error('CORS_ORIGINS required in production.');
    }

    if (process.env.SMTP_ENABLED === 'true') {
        // Never output the values; these are separate from the Hostinger login.
        for (const key of ['SMTP_USER', 'SMTP_PASSWORD']) {
            const value = process.env[key]?.trim();
            if (!value || /^(?:REPLACE_|YOUR_|<)/i.test(value)) {
                throw new Error(key + ' must be configured in the API backend secrets before enabling SMTP.');
            }
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.SMTP_USER!)) {
            throw new Error('SMTP_USER must be the complete Hostinger mailbox email address.');
        }
        if (![465, 587].includes(Number(process.env.SMTP_PORT || '465'))) {
            throw new Error('SMTP_PORT must be 465 (SSL/TLS) or 587 (STARTTLS).');
        }
        if (!process.env.STOREFRONT_PUBLIC_URL?.startsWith('https://') &&
            process.env.APP_ENV !== 'dev') {
            throw new Error('STOREFRONT_PUBLIC_URL must be HTTPS for email verification links.');
        }

    }
}
