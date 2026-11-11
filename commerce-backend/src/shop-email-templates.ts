import type {LoadTemplateInput, TemplateLoader} from '@vendure/email-plugin';
import type {Injector, RequestContext} from '@vendure/core';

const layout = (body: string) => `<mjml><mj-head><mj-attributes><mj-all font-family="Arial, sans-serif"/><mj-text font-size="16px" line-height="1.7"/></mj-attributes></mj-head><mj-body background-color="#f3f7f5"><mj-section background-color="#ffffff"><mj-column><mj-text font-size="22px" color="#087e55">Skillverse Global Shop</mj-text>${body}<mj-divider border-color="#dbe6df"/><mj-text font-size="12px">Contact / للتواصل: {{supportEmail}}</mj-text></mj-column></mj-section></mj-body></mjml>`;
const action = (title: string, description: string, arabic: string) => layout(`
    <mj-text font-size="20px">${title}</mj-text><mj-text>${description}</mj-text>
    <mj-text align="right"><div dir="rtl">${arabic}</div></mj-text>
    <mj-button href="{{actionUrl}}" background-color="#087e55">${title}</mj-button>
    <mj-text>Or open / أو افتح: <a href="{{actionUrl}}">{{actionUrl}}</a></mj-text>
    <mj-text>If you did not request this, ignore this message. / إذا لم تطلب ذلك، تجاهل الرسالة.</mj-text>`);
const summary = `<mj-text>Order / رقم الطلب: <strong>{{orderCode}}</strong></mj-text>
    <mj-table><tr><th align="left">Item / المنتج</th><th>Qty / العدد</th><th>Total / الإجمالي</th></tr>
    {{#each items}}<tr><td>{{name}}</td><td>{{quantity}}</td><td>{{total}}</td></tr>{{/each}}</mj-table>
    <mj-text>Delivery / التوصيل: {{shippingTotal}}<br/>Total / الإجمالي: <strong>{{orderTotal}}</strong></mj-text>`;
const templates: Record<string, string> = {
    'low-stock-alert': layout(`<mj-text font-size="20px">Low stock / مخزون منخفض</mj-text>
        <mj-text>SKU: {{sku}}<br/>Available / المتاح: {{available}}<br/>Alert threshold / حد التنبيه: {{threshold}}</mj-text>
        <mj-text>Review physical stock and reorder in Dashboard. / راجع المخزون الفعلي وحدّث الكميات من لوحة الإدارة.</mj-text>`),
    'email-verification': action('Verify your email', 'Activate your account to sign in and place an order.', 'فعّل بريدك الإلكتروني لتسجيل الدخول وإرسال طلبك.'),
    'password-reset': action('Reset your password', 'Use this one-time link to choose a new password.', 'استخدم الرابط لتعيين كلمة مرور جديدة لحسابك.'),
    'email-address-change': action('Verify your new email', 'Confirm this email address for your account.', 'أكّد عنوان بريدك الإلكتروني الجديد لحسابك.'),
    'admin-password-reset': action('Reset administrator password', 'Use the Dashboard to reset your administrator password.', 'استخدم لوحة الإدارة لتعيين كلمة مرور جديدة لحساب الإدارة.'),
    'cod-order-request': layout(`<mj-text font-size="20px">Order request received / استلمنا طلبك</mj-text>
        <mj-text>Hello {{customerName}}. Our team will call {{phone}} to confirm availability and delivery. Shipping is arranged manually after your confirmation.</mj-text>
        <mj-text align="right"><div dir="rtl">أهلًا {{customerName}}. هنتواصل معاك على {{phone}} لتأكيد الطلب والتوافر والتوصيل. تجهيز الشحن يدوي بعد التأكيد.</div></mj-text>
        {{#if isBankTransfer}}
        <mj-text>InstaPay / Bank Transfer: awaiting manual verification. Use order {{orderCode}} as the transfer reference. Contact us after transferring; the order is not marked paid until staff verify receipt.</mj-text>
        <mj-text align="right"><div dir="rtl">التحويل بانتظار المراجعة. استخدم رقم الطلب كمرجع وتواصل معنا بعد التحويل؛ تأكيد التحصيل يتم بعد مراجعة وصول المبلغ.</div></mj-text>
        <mj-text><div style="white-space:pre-wrap">{{paymentInstructions}}</div></mj-text>
        {{else}}<mj-text>No payment has been collected. / لم يتم تحصيل أي مبلغ.</mj-text>{{/if}}
        ${summary}<mj-button href="{{orderUrl}}" background-color="#087e55">View your order / عرض الطلب</mj-button>`),
    'cod-admin-alert': layout(`<mj-text font-size="20px">New order request / طلب جديد</mj-text>
        <mj-text>Call the customer and record the outcome in Order History / Notes. Arrange shipping manually only after confirmation.</mj-text>
        {{#if isBankTransfer}}
        <mj-text>InstaPay / Bank Transfer: verify actual receipt before settling payment. A customer statement or screenshot alone does not confirm receipt. الشحن بعد تأكيد الطلب والتحقق من وصول التحويل.</mj-text>
        {{else}}<mj-text>Cash on delivery: record settlement only after receiving cash. التحصيل يتسجل بعد استلام الفلوس فقط.</mj-text>{{/if}}
        <mj-text>Customer / العميل: {{customerName}}<br/>Email / البريد: {{customerEmail}}<br/>Phone / الهاتف: {{phone}}<br/>Address / العنوان: {{address}}</mj-text>
        ${summary}<mj-button href="{{adminOrderUrl}}" background-color="#087e55">Open order in Dashboard / فتح الطلب في الإدارة</mj-button>`),
};

/** Templates compile into dist with the server; no public dev mailbox or lost build assets. */
export class ShopEmailTemplateLoader implements TemplateLoader {
    async loadTemplate(_injector: Injector, _ctx: RequestContext, input: LoadTemplateInput): Promise<string> {
        if (!Object.prototype.hasOwnProperty.call(templates, input.type)) throw new Error('Unknown shop email template.');
        return templates[input.type];
    }
}
