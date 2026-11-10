---
type: minor
areas:
  - checkout
  - orders
  - account
  - authentication
  - tooling
---

## Intent

Support editable delivery rates per Egyptian governorate in Vendure Dashboard and manual InstaPay/bank transfer alongside cash on delivery. Supersede the proposed universal EGP 115 fee; the owner will supply governorate rates and public receiving instructions.

## Invariants

Registered verified accounts, phone confirmation and manual shipment remain required. Shipping is eligible only for the configured governorate in the Egypt EGP channel. No region receives an invented price. Transfer requests await manual verification and never settle automatically. Only an authenticated admin may record receipt. Customer metadata cannot override the merchant's transfer instructions. Cards and wallets remain disabled.

## Integration guidance

Deploy API and storefront, then configure governorate shipping methods and payment records in Dashboard as described in docs/egypt-delivery-and-transfer.md. Bank receiving details live in the method description and must be populated before enabling it. No database migration, dependencies, production records, carrier API booking or live checkout setting changes are performed by this commit. Existing email handler names are retained so queued messages still resolve.

## Verification

Run root upgrade validation, tests, lint, types and production build; backend types/server/Dashboard builds and actual payment/shipping/SMTP tests. Disposable MySQL exercises different governorates, rejects a crafted wrong-region rate, verifies price edits leave placed orders unchanged, and places COD and bank requests with separate email notifications and manual settlement.
