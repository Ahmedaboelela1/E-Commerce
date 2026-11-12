---
type: patch
areas:
  - tooling
---

## Intent

Show native Shop operations transfer-verification controls for bank payment methods with merchant-defined codes such as `01`. The Dashboard previously checked the canonical method code even though the backend already recognized the actual payment handler.

## Invariants

Only pending bank authorizations and UpdateOrder permission expose verification controls. A verified reference and explicit confirmation of actual receipt remain required before settlement. Telephone confirmation and receipt-image upload never collect funds. COD uses its separate native collection workflow. Private payment metadata is not exposed; the admin response adds only the derived offline type. Existing payment records and financial safeguards remain intact.

## Integration guidance

Deploy the backend and its native Dashboard bundle together using the normal backend build, then refresh the Dashboard. No customer storefront deployment or database migration is needed. Follow the transfer/COD confirmation steps in SHOP-OPERATIONS.md. Existing method codes may remain merchant-defined.

## Verification

Run backend checks/builds and the real MySQL operations/production Chromium suite. Verify a pending code-01 transfer shows the admin controls; a receipt/reference alone cannot enable settlement; explicit receipt confirmation settles the payment and records its reference; controls disappear after settlement; a COD order does not show bank controls. Run root tests, lint, types, upgrade validation and production build.
