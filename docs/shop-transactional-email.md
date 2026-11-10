# Skillverse shop transactional email

## Sender and Hostinger mailbox

The desired visible sender is **Skillverse Global <info@skillverse-global.com>**.
Staff alerts go separately to **ahmed@skillverse-global.com**. Replies go to info.

The owner confirmed that Hostinger Email has an ahmed mailbox and an info alias,
and reports that WRG sites already send using aliases. Follow the same separation
as WRG's mailer: authenticate with the real mailbox, ahmed, and set the visible
From and Reply-To to info. Do not create a new info mailbox or change the alias.

WRG's `jordan-notification-mailer.js` passes SMTP_USER to Nodemailer's auth and
sets the sender independently. Its `docs/jordan-registration-access-and-email.md`
documents an osama mailbox login with info as the sender. The store likewise
allows these addresses to differ; the SMTP provider decides whether the mailbox
is authorized to send using its alias. No silent sender substitution is made.
Check actual delivery and headers on this domain before opening orders.

Provider references:
- https://www.hostinger.com/support/how-to-send-emails-from-an-email-alias-using-hostinger-mail-web-app/
- https://www.hostinger.com/support/4305847-set-up-hostinger-email-on-your-applications-and-devices/

## Backend variables (api.skillverse-global.com only)

Set these on the **Vendure API backend** in
Hostinger Environment Variables. Keep existing database/session/asset settings.
Put the actual password only in the private SMTP_PASSWORD field, never in chat,
the storefront variables, Git or a committed .env file.

```dotenv
EMAIL_ENABLED=true
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ahmed@skillverse-global.com
SMTP_PASSWORD=<ahmed mailbox password, entered privately in hPanel>
EMAIL_FROM_ADDRESS=info@skillverse-global.com
EMAIL_FROM_NAME=Skillverse Global
EMAIL_ADMIN_TO=ahmed@skillverse-global.com
STOREFRONT_PUBLIC_URL=https://shop.skillverse-global.com
BACKEND_PUBLIC_URL=https://api.skillverse-global.com
RUN_JOBS_IN_SERVER=true
```

465 uses implicit TLS with certificate verification. Hostinger's alternative is
587 with SMTP_SECURE=false; STARTTLS is required, never downgraded to plaintext.
Do not turn off certificate checks. SMTP protocol logging stays disabled.

The low-volume Hostinger pilot already runs its SQL-backed job queue inside the
API process when RUN_JOBS_IN_SERVER=true. Leave it enabled unless a separate
worker is running. Pending jobs survive a process restart, but cannot deliver
until a process is alive and consuming the queue. A separate worker must receive
the same email settings. Keep the worker and API sender configuration consistent.

No new database migration is needed. Deploy backend code and dependencies from
this change. The full repository also includes the pending account-required COD
storefront changes; deploy the matching storefront code. The owner has authorized
checkout activation and its old launch flag is retired. Email settings do not
activate/create any payment or shipping method.

## Messages

- Registration and resend-verification events: customer verification link at
  /en/verify?token=... (or /de/verify for the German storefront).
- Customer password reset: /en/reset-password?token=... .
- Email address change: new address only, /en/account/verify-email?token=... .
- Administrator password reset: the Dashboard reset page on the API domain.
- Egypt offline order request: sent on the initial ArrangingPayment →
  PaymentAuthorized transition only, with an Authorized cash-on-delivery or bank-transfer payment
  in the skillverse-eg EGP channel. Customer receives the code, items and total;
  staff separately receive contact/address details and the authenticated Dashboard
  order link. Both messages explicitly describe telephone confirmation and manual
  shipping. Bank requests include the snapshotted public receiving instructions
  and order reference, explicitly awaiting manual verification. No receipt of payment or shipment is claimed. Later settlement/modification
  does not resend this initial acknowledgement.

Templates compile with the server and include HTML and plain text. Customer
content is escaped. There is no public development mailbox, attached invoice,
automatic phone-confirmed status, automatic shipment or settlement.

## Verification before opening orders

1. Confirm ahmed authenticates to SMTP and Hostinger accepts its configured info
   alias as the sender. Check SPF/DKIM against the email dashboard; this change
   does not edit DNS or mailbox settings.
2. Keep checkout disabled. Register an agreed test customer; inspect From and
   Reply-To in the received mail, activate the account and sign in. Confirm token
   links use the shop domain. Test password reset and resend verification.
3. In staging, place a COD request from a verified account with real configured
   test shipping/stock. Confirm separate customer/admin emails and record the phone
   call in Dashboard Order History / Notes. Shipping is manual after confirmation;
   record settlement only after actual cash collection.
4. Check System → Job Queue → send-email for failures/retries. Restart/redeploy
   and verify a pending email is delivered afterwards. A successful SMTP response
   means the provider accepted the message, not proof of inbox placement; check
   the recipient inbox/spam too. Staff should monitor Orders directly.

Local automated tests use disposable MySQL and a loopback SMTP capture server.
They verify authentication as ahmed while messages show info in From/Reply-To.
They do not connect to Hostinger SMTP, send real mail, change mailboxes or prove
that the managed Hostinger process stays awake while idle.
