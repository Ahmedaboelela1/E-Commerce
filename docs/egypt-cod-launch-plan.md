# Skillverse Egypt — registered-account COD checkout (staged, NOT live)

**Decision:** For the first launch, customers must create and sign in to an account, provide a reachable mobile number and Egyptian shipping address, and submit an order request. Skillverse staff then call the customer and confirm the order by phone before preparing/shipping it. **Visa/card payments are a future integration only**, disabled today. No payment should be collected online.

## Customer flow

1. Browse INEX catalog in `skillverse-eg` with prices in EGP, add an in-stock product.
2. Proceed to checkout. Anonymous visitors are redirected to `/sign-in?redirectTo=/checkout` and can navigate to registration. A verified registered account is required; guest checkout is disabled by the storefront and the backend COD handler.
3. Registration requires first and last name, email, phone number and password. Vendure `requireVerification=true` remains enabled — customer must receive and click a verification email and then log in.
4. Address step requires recipient phone, street, city and country. Configure Egypt only for this channel's shipping eligibility.
5. Choose a configured real `cash-on-delivery` payment method. Card option is displayed as **coming soon** and is not selectable. Delivery price is displayed in EGP.
6. Vendure records the order with COD Payment state `Authorized` **only** — no cash is captured. Customer sees **Order request received — we'll call you**; this is not a shipment confirmation.
7. Staff access **Vendure Dashboard → Orders** in the Egypt channel, view the customer email, name, phone number, items and delivery address, then **call the customer**.
8. Staff record the phone-call outcome using an **Order History / Note**: confirmed, changed, cancelled or unable to reach. **Only prepare/ship confirmed orders.** COD Payment must be settled **only after actual cash collection**, not after a phone call; cancellation never counts as payment.
9. Visa gateway has no handler, no keys and no payment method. It must remain unavailable until a payment provider is integrated and separately tested.

**Important limitation:** This initial patch uses the built-in order notes and manual process. It does **not** provide an automated phone-confirmed status or technical fulfillment lock. Train authorized operators and consider a dedicated OrderProcess/custom field before scaling.

## Mandatory go-live gates

- Set up and **end-to-end test transactional email sending** in Vendure, including registration verification, resend verification, password reset and the customer's order acknowledgement. The current backend does not have an EmailPlugin or SMTP transport configured. Leave `authOptions.requireVerification=true` and checkout disabled until fixed; do **not** bypass it merely to launch quickly.
- Correct image storage: set the persistent `ASSET_UPLOAD_DIR`, reupload missing INEX product pictures, and test after another redeploy.
- Confirm **real** stock counts and stock locations; do not accept orders for zero-stock variants unless a genuine preorder policy is implemented.
- Add an Egypt Channel **Shipping Method** with a real approved rate and destination eligibility; check taxes and whether listed EGP prices include tax.
- Configure a payment method in Vendure Dashboard **Settings → Payment Methods**: code `cash-on-delivery`, handler `cash-on-delivery`, name `Cash on Delivery`, and assign it **only** to `skillverse-eg`. Don't configure a Visa method.
- Confirm the legal seller, invoices, Egyptian consumer/returns/privacy policies, secure handling of phone/address/customer data and consent for order-related calls.
- Set up reliable administration alerts for new orders, and test Jobs/restarts under Hostinger Business's limitations. Staff must monitor Orders even if an email is delayed.
- Test the full flow in a **staging channel** with a newly registered customer, valid mobile, email verification, cart, successful COD request, admin phone-call note, cancellation, stock adjustments, and recording cash collection on receipt. Verify no card collection and no misleading 'Payment Settled' state on request.
- Only then configure `NEXT_PUBLIC_ENABLE_CHECKOUT=true` on the **shop** Node.js site and redeploy. Do not change that environment setting just because GitHub CI passed.

## Deployment safety

The backend registers a COD PaymentMethodHandler, but does **not** automatically create a live PaymentMethod in the database. The order pages remain disabled while `NEXT_PUBLIC_ENABLE_CHECKOUT=false`. No real customer, payment or shipping data are seeded by these changes. Both `shop.skillverse-global.com` and `api.skillverse-global.com` must use the compatible updated GitHub code before testing.

Vendure's two-step payment lifecycle deliberately permits an `Authorized` state with no funds collected; settlement is a later admin action following physical cash receipt.

Docs:
- https://docs.vendure.io/current/framework/core-concepts/payment
- https://docs.vendure.io/current/framework/core-concepts/user-management
- https://docs.vendure.io/current/framework/reference/core-plugins/email-plugin
