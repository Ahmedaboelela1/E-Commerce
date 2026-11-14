---
type: patch
areas:
  - tooling
---

## Intent

Use the existing Sales → Shop operations page for product management, seller accounts, delivery rates and payment methods. Remove the separate Store/Selling workspace navigation. Keep one administrator Orders list and integrate item-level dispatch, shipment updates, cancellation and refunds inside its opened order alongside callback, transfer/cash verification and invoices. Sellers use the same Sales entry and their scoped order projection.

## Invariants

All existing capability and store/owner API checks remain unchanged. Seller accounts receive no native aggregate-order or catalog permissions and cannot access administrator payment/account/settings tabs. Existing native staff without marketplace capabilities keep their previous order and shipping controls. Existing data, role assignments, cart/checkout behavior, financial records and invoice snapshots are untouched. Channel changes discard the previous store's form state. Legacy /store-workspace links redirect to the corresponding tab at /shop-operations without registering an additional menu or section.

## Integration guidance

Redeploy the backend Dashboard bundle and refresh the Dashboard. No migration, account recreation or customer storefront change is required. Open Sales → Shop operations. Use Products, Delivery rates, Payments and Team & sellers tabs according to role; use Orders for the single order list and its integrated shipment/refund controls. See SHOP-MARKETPLACE.md for the updated account setup path.

## Verification

Run backend types/server/Dashboard builds, real MySQL seller-isolation tests and production Chromium flows for seller product creation, restricted orders, central administrator orders with embedded shipping/refunds, a single Sales navigation/tab list, absent Store navigation and legacy-link redirects. Re-run existing operations and native Dashboard browser regressions, plus required root tests, lint, types, upgrade validation and production build.
