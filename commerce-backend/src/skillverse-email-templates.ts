import type {Injector, RequestContext} from '@vendure/core';
import type {TemplateLoader} from '@vendure/email-plugin';

/**
 * Self-contained MJML/Handlebars templates: unlike filesystem templates these
 * remain part of the compiled dist after Hostinger's build-directory rotation.
 * No customer's secrets or SMTP credentials are embedded in these templates.
 */
function layout(title: string, body: string): string {
    return `<mjml>
      <mj-head>
        <mj-title>${title}</mj-title>
        <mj-attributes>
          <mj-all font-family="Arial, sans-serif" />
          <mj-text color="#102140" font-size="15px" line-height="24px" />
          <mj-button background-color="#2E5EAB" color="#ffffff" border-radius="5px" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f5f7fa">
        <mj-section background-color="#102140" padding="24px">
          <mj-column>
            <mj-text align="center" color="#ffffff" font-size="23px" font-weight="bold">
              SkillVerse <span style="color:#91b8fa;">GLOBAL</span>
            </mj-text>
          </mj-column>
        </mj-section>
        <mj-section background-color="#ffffff" padding="26px">
          <mj-column>
            <mj-text font-size="21px" font-weight="bold">${title}</mj-text>
            ${body}
          </mj-column>
        </mj-section>
        <mj-section padding="16px">
          <mj-column>
            <mj-text align="center" font-size="12px" color="#596a7d">
              Skillverse Global · Egypt · info@skillverse-global.com<br/>
              This message concerns your account or an order request.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>`;
}

const templates: Record<string, string> = {
    'email-verification': layout('Verify your email address', `
        <mj-text>Thank you for creating a Skillverse Global account. Verify your email to activate your account and place orders.</mj-text>
        <mj-button href="{{ verifyEmailAddressUrl }}?token={{ verificationToken }}">Verify my email</mj-button>
        <mj-text>If you did not create an account, you can ignore this message.</mj-text>
    `),
    'password-reset': layout('Reset your password', `
        <mj-text>Someone requested a password reset for your Skillverse Global account.</mj-text>
        <mj-button href="{{ passwordResetUrl }}?token={{ passwordResetToken }}">Reset password</mj-button>
        <mj-text>If you did not request this, your password has not changed. You can ignore this message.</mj-text>
    `),
    'admin-password-reset': layout('Admin password reset', `
        <mj-text>A password reset was requested for your Skillverse Global administrator account.</mj-text>
        <mj-button href="{{ adminPasswordResetUrl }}?token={{ passwordResetToken }}">Reset admin password</mj-button>
        <mj-text>If you did not request this, ignore this message and review your administrator account security.</mj-text>
    `),
    'email-address-change': layout('Confirm your new email address', `
        <mj-text>Please confirm that you want to use this email address for your Skillverse Global account.</mj-text>
        <mj-button href="{{ changeEmailAddressUrl }}?token={{ identifierChangeToken }}">Confirm email address</mj-button>
        <mj-text>If you did not request this change, contact our team.</mj-text>
    `),
    // The default Vendure order-confirmation event fires when the payment is
    // *settled*. COD requests instead use order-request-received below.
    'order-confirmation': layout('Cash payment recorded', `
        <mj-text>The payment for order <strong>#{{ order.code }}</strong> has been recorded.</mj-text>
        <mj-text>Amount: <strong>{{ formatMoney order.totalWithTax order.currencyCode 'en' }}</strong></mj-text>
        <mj-text>Thank you for choosing Skillverse Global.</mj-text>
    `),
    'order-request-received': layout('We received your order request', `
        <mj-text>Hi {{ order.customer.firstName }},</mj-text>
        <mj-text>We received your order request <strong>#{{ order.code }}</strong>.</mj-text>
        <mj-text>Our team will call your delivery phone number to confirm availability, delivery and order details <strong>before shipping</strong>.</mj-text>
        <mj-text>Order total shown at checkout: <strong>{{ formatMoney order.totalWithTax order.currencyCode 'en' }}</strong></mj-text>
        <mj-text><strong>Payment method: Cash on Delivery.</strong> No payment has been collected and the order has not yet been confirmed for shipment.</mj-text>
    `),
    'order-request-admin': layout('New order request - call customer', `
        <mj-text>New Skillverse Egypt order request <strong>#{{ order.code }}</strong> is awaiting a phone call.</mj-text>
        <mj-text>Customer: {{ order.customer.firstName }} {{ order.customer.lastName }}</mj-text>
        <mj-text>Email: {{ order.customer.emailAddress }}</mj-text>
        <mj-text>Delivery contact: {{ order.shippingAddress.fullName }} / {{ order.shippingAddress.phoneNumber }}</mj-text>
        <mj-text>Shipping: {{ order.shippingAddress.streetLine1 }}, {{ order.shippingAddress.city }}, {{ order.shippingAddress.province }}</mj-text>
        <mj-text>Total: <strong>{{ formatMoney order.totalWithTax order.currencyCode 'en' }}</strong> (Cash on Delivery, not collected)</mj-text>
        <mj-text><strong>Action:</strong> Open the Egypt channel in the Vendure Dashboard, confirm the order by phone and record the result in Order History. Do not dispatch before confirmation.</mj-text>
        <mj-button href="{{ adminOrdersUrl }}">Open orders</mj-button>
    `),
};

export class SkillverseEmailTemplateLoader implements TemplateLoader {
    async loadTemplate(
        _injector: Injector,
        _ctx: RequestContext,
        input: {type: string; templateName: string},
    ): Promise<string> {
        if (input.templateName !== 'body.hbs' || !Object.prototype.hasOwnProperty.call(templates, input.type)) {
            throw new Error(`No Skillverse transactional email template for ${input.type}/${input.templateName}`);
        }
        return templates[input.type];
    }
}
