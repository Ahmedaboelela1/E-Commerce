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
    if (process.env.SMTP_ENABLED !== 'true') {
        if (process.env.APP_ENV !== 'dev') {
            console.warn('Transactional email is OFF (SMTP_ENABLED is not true); customer registration cannot be launched.');
        }
        return [];
    }

    const user = process.env.SMTP_USER!;
    const password = process.env.SMTP_PASSWORD!;
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
