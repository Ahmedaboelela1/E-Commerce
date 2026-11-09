# Hostinger Email SMTP → Skillverse Vendure 3.8

**Status: code ready to review, not connected to the real mailbox until the owner enters private settings on Hostinger and tests end-to-end.**

The customer mailbox exists already: **info@skillverse-global.com**. Do not create another email account, disable verification, paste its password into GitHub or ChatGPT, or use the Hostinger hPanel login password.

## 1. Read Hostinger's live mailbox SMTP settings

In hPanel → **Emails** → **Manage** for `skillverse-global.com` → **Connect Apps & Devices** → **Manual Configuration**. Hostinger Email normally provides:

- SMTP Host: `smtp.hostinger.com`
- Port: **465**
- Encryption: **SSL/TLS**
- Username: **info@skillverse-global.com**
- Password: the mailbox's actual password, entered in **private Hostinger Environment Variables** only
- If port 465 fails, try port **587 with STARTTLS** (this code automatically selects requireTLS=true on 587).

Source: https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/

Verify mailbox sending and receiving in Hostinger Webmail before testing Vendure.

## 2. Add variables on the **API BACKEND** application

In hPanel, select **api.skillverse-global.com → Node.js app → Environment Variables**, not `shop.skillverse-global.com`.

```dotenv
SMTP_ENABLED=true
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@skillverse-global.com
SMTP_PASSWORD=<mailbox-password-set-privately-in-hPanel>
ORDER_NOTIFICATION_EMAIL=info@skillverse-global.com
STOREFRONT_PUBLIC_URL=https://shop.skillverse-global.com
BACKEND_PUBLIC_URL=https://api.skillverse-global.com
RUN_JOBS_IN_SERVER=true
```

- **Never commit `SMTP_PASSWORD` to GitHub or reveal it in conversation or screenshots.**
- Existing backend DB and Super Admin variables stay unchanged.
- When `SMTP_ENABLED` is absent or `false`, the EmailPlugin is not loaded; the customer shop remains catalog-only until the tests pass.
- Setting `SMTP_ENABLED=true` without valid `SMTP_USER` and `SMTP_PASSWORD` **causes intentional startup validation failure**, to prevent silent registration failures. Only turn it on once the secrets have been added.
- Emails are generated from bundled MJML templates compiled into `dist`, so they don't depend on the temporary Hostinger hbuilds directory.
- No public development `/mailbox` route is enabled, and debug logs must stay off.

## 3. Deploy *backend only* from a reviewed branch

After GitHub checks pass and the PR is merged, redeploy the **api** Node.js application using `main` and the existing Vendure build `npm run build`, root `commerce-backend`, entry `dist/index.js`.

The change introduces dependency `@vendure/email-plugin@3.8.0` and uses the same Vendure core version.

**Do not enable the public shop Checkout** or enable a Visa payment gateway as part of this deployment.

## 4. Actual end-to-end acceptance tests

Use a **new personal test email address**, not an existing customer, and a test mobile number controlled by your team.

1. Visit `https://shop.skillverse-global.com/en/register`. Register a test account. Confirm the verification email arrives, the button points to `https://shop.skillverse-global.com/en/verify?token=…`, and you can complete verification and log in.
2. Test `https://shop.skillverse-global.com/en/forgot-password` and its reset link `/en/reset-password?token=…` from a new message.
3. Confirm admin forgot-password email from Vendure Dashboard points to `https://api.skillverse-global.com/dashboard/reset-password?token=…` (if you enable/admin-test that flow).
4. Confirm mailbox SPF/DKIM/DMARC records and that transactional emails don't land in spam.
5. Check Vendure **System → Jobs/Job Queue**: `send-email` jobs are processed after registration and server restarts. The current Hostinger Business single-process worker is a **pilot**, not a durable dedicated background worker.
6. After the **separate** registered-account COD checkout PR is ready, configure shipping and COD with real stock; test one **controlled staging order**. The customer should receive *Order request received* and staff should receive *Call to confirm order* with order code, delivery phone/address and no false payment confirmation.
7. Verify only the **PaymentAuthorized** state triggers those order-request emails; actual cash collection is recorded as settled later. Do not dispatch without the required phone call.

**Important:** Order emails are triggered only after the COD backend checkout is implemented and activated; enabling SMTP alone does not create live customer orders.

If the registration email does not arrive, inspect API logs and Vendure `send-email` queue before retrying. Wrong SMTP credentials, port/firewall restrictions, incomplete SPF/DKIM records, or blocked background jobs may be responsible.

## Privacy and safety

Email notifications contain an order phone/address only to the configured staff recipient. Limit access to that mailbox, use 2FA where available, and avoid unnecessary forwarding. Never send passwords in email; reset/verification links expire as configured by Vendure. Check current Egyptian privacy/returns and merchant requirements before collecting real customer data.

## Related PR

The account-required COD checkout is staged separately in `feat/egypt-account-required-cod-checkout` (PR #9); this SMTP patch can be built independently. Both must be verified before turning on `NEXT_PUBLIC_ENABLE_CHECKOUT=true`.
