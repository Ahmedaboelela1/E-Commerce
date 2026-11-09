import {
    AccountRegistrationEvent, AdministratorPasswordResetEvent, EntityHydrator,
    IdentifierChangeRequestEvent, OrderStateTransitionEvent, PasswordResetEvent,
    type User,
} from '@vendure/core';
import {EmailEventListener, type EmailPluginOptions} from '@vendure/email-plugin';
import type {ShopEmailSettings} from './email-settings';
import {ShopEmailTemplateLoader} from './shop-email-templates';

function tokenUrl(base: string, path: string, token: string | null | undefined): string {
    if (!token) throw new Error('Cannot generate an account email without its token.');
    const url = new URL(path, base);
    url.searchParams.set('token', token);
    return url.href;
}
function authToken(user: User, name: 'verificationToken' | 'passwordResetToken' | 'identifierChangeToken') {
    return user.getNativeAuthenticationMethod()[name];
}
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-EG', {style: 'currency', currency}).format(amount / 100);

export function createShopEmailOptions(settings: ShopEmailSettings): EmailPluginOptions {
    const from = `${JSON.stringify(settings.fromName)} <${settings.fromAddress}>`;
    const replyTo = () => ({replyTo: settings.fromAddress});
    const verification = new EmailEventListener('email-verification').on(AccountRegistrationEvent)
        .filter(event => !!authToken(event.user, 'verificationToken'))
        .setRecipient(event => event.user.identifier).setFrom(from).setOptionalAddressFields(replyTo)
        .setSubject('Skillverse Global — verify your email / تفعيل البريد')
        .setTemplateVars((event, globals) => ({actionUrl: tokenUrl(settings.storefrontUrl, `/${globals.locale}/verify`, authToken(event.user, 'verificationToken'))}))
        .setPlainTextBody((_event, vars) => `Verify your email / فعّل بريدك الإلكتروني:\n${vars.actionUrl}\nIf you did not request this, ignore this message.`);
    const password = new EmailEventListener('password-reset').on(PasswordResetEvent)
        .filter(event => !!authToken(event.user, 'passwordResetToken'))
        .setRecipient(event => event.user.identifier).setFrom(from).setOptionalAddressFields(replyTo)
        .setSubject('Skillverse Global — reset password / استعادة كلمة المرور')
        .setTemplateVars((event, globals) => ({actionUrl: tokenUrl(settings.storefrontUrl, `/${globals.locale}/reset-password`, authToken(event.user, 'passwordResetToken'))}))
        .setPlainTextBody((_event, vars) => `Reset your password / استعادة كلمة المرور:\n${vars.actionUrl}\nIf you did not request this, ignore this message.`);
    const emailChange = new EmailEventListener('email-address-change').on(IdentifierChangeRequestEvent)
        .filter(event => !!authToken(event.user, 'identifierChangeToken'))
        .setRecipient(event => event.user.getNativeAuthenticationMethod().pendingIdentifier!)
        .setFrom(from).setOptionalAddressFields(replyTo)
        .setSubject('Skillverse Global — verify new email / تأكيد البريد الجديد')
        .setTemplateVars((event, globals) => ({actionUrl: tokenUrl(settings.storefrontUrl, `/${globals.locale}/account/verify-email`, authToken(event.user, 'identifierChangeToken'))}))
        .setPlainTextBody((_event, vars) => `Verify your new email / أكّد بريدك الجديد:\n${vars.actionUrl}`);
    const adminReset = new EmailEventListener('admin-password-reset').on(AdministratorPasswordResetEvent)
        .filter(event => !!authToken(event.user, 'passwordResetToken'))
        .setRecipient(event => event.administrator.emailAddress).setFrom(from).setOptionalAddressFields(replyTo)
        .setSubject('Skillverse Global — administrator password reset')
        .setTemplateVars(event => ({actionUrl: tokenUrl(settings.backendUrl, '/dashboard/reset-password', authToken(event.user, 'passwordResetToken'))}))
        .setPlainTextBody((_event, vars) => `Reset your administrator password:\n${vars.actionUrl}`);

    const orderHandler = (admin: boolean) => new EmailEventListener(admin ? 'cod-admin-alert' : 'cod-order-request')
        .on(OrderStateTransitionEvent)
        .filter(event => event.fromState === 'ArrangingPayment' && event.toState === 'PaymentAuthorized' &&
            event.ctx.channel.code === 'skillverse-eg' && event.order.currencyCode === 'EGP')
        .loadData(async ({event, injector}) => {
            await injector.get(EntityHydrator).hydrate(event.ctx, event.order, {
                relations: ['customer', 'payments', 'lines.productVariant', 'shippingLines.shippingMethod'],
            });
            if (!event.order.customer?.emailAddress || !event.order.payments?.some(payment =>
                payment.method === 'cash-on-delivery' && payment.state === 'Authorized')) {
                throw new Error('COD notification requires an authorized cash-on-delivery request and a customer.');
            }
            return {order: event.order};
        })
        .setRecipient(event => admin ? settings.adminAddress : event.data.order.customer!.emailAddress)
        .setFrom(from).setOptionalAddressFields(replyTo)
        .setSubject(admin ? 'New COD request #{{orderCode}} — call before shipping' : 'Order request #{{orderCode}} — awaiting phone confirmation')
        .setTemplateVars((event, globals) => {
            const order = event.data.order;
            return {
                orderCode: order.code,
                customerName: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' '),
                customerEmail: order.customer!.emailAddress,
                phone: order.shippingAddress?.phoneNumber || order.customer?.phoneNumber || '',
                address: [order.shippingAddress?.streetLine1, order.shippingAddress?.streetLine2,
                    order.shippingAddress?.city, order.shippingAddress?.postalCode, order.shippingAddress?.country].filter(Boolean).join(', '),
                orderTotal: money(order.totalWithTax, order.currencyCode),
                shippingTotal: money(order.shippingWithTax, order.currencyCode),
                items: order.lines.map(line => ({name: line.productVariant?.name || line.productVariant?.sku || 'Item',
                    quantity: line.quantity, total: money(line.linePriceWithTax, order.currencyCode)})),
                orderUrl: new URL(`/${globals.locale}/account/orders/${encodeURIComponent(order.code)}`, settings.storefrontUrl).href,
                adminOrderUrl: new URL(`/dashboard/orders/${encodeURIComponent(String(order.id))}`, settings.backendUrl).href,
            };
        })
        .setPlainTextBody((_event, vars) => `${admin ? 'New COD request — call before shipping' : 'Order request received — we will call you'}\n` +
            `رقم الطلب: ${vars.orderCode}\n${vars.customerName}\nPhone / الهاتف: ${vars.phone}\n` +
            (admin ? `Email: ${vars.customerEmail}\nAddress: ${vars.address}\n` : '') +
            `Total / الإجمالي: ${vars.orderTotal}\nShipping is arranged manually after phone confirmation. No cash has been collected.\n` +
            `الشحن يدوي بعد التأكيد التليفوني. لم يتم تحصيل أي مبلغ.\n${admin ? vars.adminOrderUrl : vars.orderUrl}`)
        .setMetadata(event => ({kind: admin ? 'cod-admin-alert' : 'cod-order-request', orderId: event.order.id}));

    return {
        transport: {type: 'smtp', host: settings.host, port: settings.port, secure: settings.secure,
            requireTLS: settings.requireTLS, auth: {user: settings.user, pass: settings.password},
            tls: {rejectUnauthorized: true, minVersion: 'TLSv1.2'}, logging: false,
            connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000},
        handlers: [verification, password, emailChange, adminReset, orderHandler(false), orderHandler(true)],
        templateLoader: new ShopEmailTemplateLoader(),
        globalTemplateVars: async ctx => ({supportEmail: settings.fromAddress, locale: ctx.languageCode === 'de' ? 'de' : 'en'}),
    };
}
