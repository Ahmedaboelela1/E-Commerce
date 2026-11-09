---
type: patch
areas:
  - authentication
  - orders
  - tooling
---

## Intent

Remove the unnecessary Hostinger SMTP login/sender equality restriction. Match WRG's mailer by authenticating as ahmed and sending from its existing info alias.

## Invariants

SMTP credentials and visible sender are independent. TLS verification, address/header validation, opt-in email, manual confirmation/shipping and disabled checkout remain enforced. Never substitute a different sender or log passwords. Provider authorization of the alias is verified through actual delivery.

## Integration guidance

Deploy the API backend with SMTP_USER=ahmed@skillverse-global.com, its password in the private SMTP_PASSWORD setting, and EMAIL_FROM_ADDRESS=info@skillverse-global.com. Keep EMAIL_ADMIN_TO=ahmed@skillverse-global.com. No new mailbox, alias change, dependency update or database migration is needed. Follow docs/shop-transactional-email.md for delivery verification.

## Verification

Run upgrade validation, tests, lint, types and production builds. Local SMTP tests assert the authenticated username and info sender separately; disposable MySQL tests exercise queued verification, password reset and COD messages. Local captures do not prove Hostinger acceptance or inbox placement; verify these after deployment before opening checkout.
