export interface ShopEmailSettings {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    password: string;
    fromAddress: string;
    fromName: string;
    adminAddress: string;
    storefrontUrl: string;
    backendUrl: string;
}

const mailbox = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i;
function email(value: string | undefined, key: string): string {
    const address = value?.trim() || '';
    if (!mailbox.test(address) || /[\r\n]/.test(address)) throw new Error(`${key} must contain one email address.`);
    return address;
}
function publicUrl(value: string | undefined, key: string, development: boolean): string {
    let url: URL;
    try { url = new URL(value || ''); } catch { throw new Error(`${key} must be a public HTTPS URL.`); }
    const local = development && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
        url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error(`${key} must be an HTTPS origin without credentials, query or path.`);
    }
    return url.origin;
}

/** No sending until explicitly configured; enabling incomplete SMTP fails visibly. */
export function readShopEmailSettings(env: NodeJS.ProcessEnv = process.env): ShopEmailSettings | undefined {
    if (!env.EMAIL_ENABLED || env.EMAIL_ENABLED === 'false') return;
    if (env.EMAIL_ENABLED !== 'true') throw new Error('EMAIL_ENABLED must be true or false.');
    const development = env.APP_ENV === 'dev';
    const host = env.SMTP_HOST?.trim() || 'smtp.hostinger.com';
    if (!/^[a-z0-9.:-]+$/i.test(host)) throw new Error('SMTP_HOST is invalid.');
    const port = Number(env.SMTP_PORT || 465);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT is invalid.');
    if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE must be true or false.');
    const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
    const local = development && ['localhost', '127.0.0.1', '::1'].includes(host);
    if (!local && !((port === 465 && secure) || (port === 587 && !secure))) {
        throw new Error('Use SMTP port 465 with SSL or 587 with required STARTTLS.');
    }
    const user = email(env.SMTP_USER, 'SMTP_USER');
    const fromAddress = email(env.EMAIL_FROM_ADDRESS || 'info@skillverse-global.com', 'EMAIL_FROM_ADDRESS');
    // Like WRG's mailer, authenticate with the real mailbox and keep the visible
    // sender separate. The SMTP provider authorizes the mailbox's alias at send time.
    const password = env.SMTP_PASSWORD || '';
    if (!password.trim() || /^(REPLACE_|YOUR_|<)/i.test(password)) throw new Error('SMTP_PASSWORD must be set privately in the hosting environment.');
    const fromName = env.EMAIL_FROM_NAME?.trim() || 'Skillverse Global';
    if (/[\r\n]/.test(fromName) || fromName.length > 100) throw new Error('EMAIL_FROM_NAME is invalid.');
    return {
        host, port, secure, requireTLS: !local && !secure, user, password, fromAddress, fromName,
        adminAddress: email(env.EMAIL_ADMIN_TO || 'ahmed@skillverse-global.com', 'EMAIL_ADMIN_TO'),
        storefrontUrl: publicUrl(env.STOREFRONT_PUBLIC_URL, 'STOREFRONT_PUBLIC_URL', development),
        backendUrl: publicUrl(env.BACKEND_PUBLIC_URL, 'BACKEND_PUBLIC_URL', development),
    };
}
