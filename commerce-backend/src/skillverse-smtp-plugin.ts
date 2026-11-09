import {EmailPlugin} from '@vendure/email-plugin';
import {SkillverseEmailTemplateLoader} from './skillverse-email-templates';
import {skillverseEmailHandlers} from './skillverse-email-handlers';

/**
 * Hostinger SMTP is opt-in. Never open a dev mailbox publicly, and never
 * disable verification if SMTP has not yet been configured.
 *
 * Production variables are held in hPanel for api.skillverse-global.com only.
 */
export function getSkillverseEmailPlugins() {
    // No additional SMTP_ENABLED toggle is required in Hostinger. The email
    // integration starts automatically after both mailbox credentials exist.
    // Keep the production API online when the account has not yet been wired.
    const user = process.env.SMTP_USER?.trim() || '';
    const password = process.env.SMTP_PASSWORD?.trim() || '';
    const isRealSecret = (value: string) => Boolean(value) && !/^(?:REPLACE_|YOUR_|<)/i.test(value);
    if (!user || !isRealSecret(password)) {
        if (process.env.APP_ENV !== 'dev') {
            console.warn('Transactional email not configured: add SMTP_USER and SMTP_PASSWORD to the API website environment; checkout remains disabled.');
        }
        return [];
    }
    const port = Number(process.env.SMTP_PORT || 465);
    const storefront = (process.env.STOREFRONT_PUBLIC_URL || '').replace(/\/$/, '');
    const backend = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');

    return [
        EmailPlugin.init({
            handlers: skillverseEmailHandlers,
            templateLoader: new SkillverseEmailTemplateLoader(),
            transport: {
                type: 'smtp',
                host: process.env.SMTP_HOST || 'smtp.hostinger.com',
                port,
                secure: port === 465,
                requireTLS: port === 587,
                auth: {user, pass: password},
                connectionTimeout: 15_000,
                greetingTimeout: 15_000,
                socketTimeout: 20_000,
                // Never log SMTP authentication details or customer email bodies.
                logging: false,
                debug: false,
            },
            globalTemplateVars: {
                fromAddress: `"Skillverse Global" <${user}>`,
                verifyEmailAddressUrl: `${storefront}/en/verify`,
                passwordResetUrl: `${storefront}/en/reset-password`,
                changeEmailAddressUrl: `${storefront}/en/account/verify-email`,
                adminPasswordResetUrl: `${backend}/dashboard/reset-password`,
                adminOrdersUrl: `${backend}/dashboard/orders`,
            },
        }),
    ];
}
