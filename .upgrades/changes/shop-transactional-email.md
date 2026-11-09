---
type: minor
areas:
  - authentication
  - orders
  - tooling
---

## Intent

Add opt-in transactional email for account verification, password reset, address changes and COD request acknowledgement, plus a separate staff alert. Keep order confirmation by telephone and shipment manual.

## Invariants

- Email is disabled unless explicitly configured. Missing credentials or invalid TLS settings fail visibly when enabled. Verification stays required and checkout stays disabled pending launch readiness.
- No email delivery changes payment, confirmation or fulfillment state. COD emails say that no cash has been collected, and shipment follows manual telephone confirmation.
- Authentication messages go only to the account address, with correct encoded storefront/Dashboard token links. Staff receive a separate order alert, never a copy of account tokens.
- Authenticate using the real ahmed mailbox and display its configured info alias, matching WRG's separation of SMTP credentials and sender. Verify provider acceptance and inbox delivery; never silently substitute a different From address.

## Integration guidance

Use the existing SQL-backed send-email queue in API pilot mode or a dedicated worker. Preserve the in-code templates in backend builds; do not expose a development mailbox. See docs/shop-transactional-email.md for provider setup, private environment variables and real delivery verification. No production migration, mailbox deletion or checkout activation is performed.

## Verification

Run root upgrade validation, tests, lint, types and production build. Run backend type/server/dashboard builds, real MJML/SMTP tests, and isolated MySQL registration/verification/password-reset tests including restart persistence and a temporary SMTP failure. Verify actual inbox delivery and sender headers on Hostinger separately before enabling checkout.
