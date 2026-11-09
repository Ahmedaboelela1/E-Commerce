---
type: minor
areas:
  - tooling
---

## Intent

Connect the existing Hostinger Email mailbox `info@skillverse-global.com` to Vendure 3.8 via secure SMTP while keeping customer checkout disabled until a live registration/email test succeeds.

## Invariants

- Never store mailbox credentials in GitHub, static files, browser/public env variables or model chat.
- No SMTP_ENABLED toggle is needed; the plugin loads automatically only after the owner supplies both private SMTP credentials. Missing credentials leave the running API unchanged.
- Hostinger's published SMTP settings: `smtp.hostinger.com`, port 465 SSL/TLS; fallback 587 STARTTLS.
- Transactional templates (email verification, password reset, admin reset, email change, payment receipt) and COD order-request/customer-staff notices are bundled in compiled JS, not in disposable upload directories.
- COD email notices say the order **needs telephone confirmation** and no cash has been collected.
- The EmailPlugin adds no Visa gateway, no payment method, no guest checkout and no database migration.
- `NEXT_PUBLIC_ENABLE_CHECKOUT=false` remains unchanged.
- Production never enables public development mailbox routes or logs SMTP secrets.

## Integration guidance

See `commerce-backend/HOSTINGER-SMTP.md`. Add `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_USER=info@skillverse-global.com`, `SMTP_PASSWORD` (privately), and `ORDER_NOTIFICATION_EMAIL=info@skillverse-global.com` on the Vendure **API** website on Hostinger. Redeploy **backend only**, then test a fresh registration, verification token URL, reset password and email queue processing. Do not open checkout until separate PR #9 and all other go-live checks are complete.

## Verification

Backend TypeScript checks and build, bundled-template node tests, isolated first boot, customer verification and password reset smoke tests via real Hostinger Email, with SSL and TLS fallback as needed.
