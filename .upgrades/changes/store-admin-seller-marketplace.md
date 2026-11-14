---
type: minor
areas:
  - checkout
  - tooling
---

## Intent

Introduce delegated store administrators and independent sellers in one Skillverse storefront. Customers keep one native order and central payment; sellers manage only their products, stock, governorate delivery rates and owned order items. Store administrators manage all sellers within their assigned store. Seller-created variants receive native product options, so every SKU can be selected and purchased from the existing product page.

## Invariants

ManageStore and SellOwnProducts grant no native catalog, aggregate-order, administrator, channel, settings or system CRUD permission. Custom resolvers enforce current store membership and immutable product/line ownership on every read/write. Native sensitive APIs remain denied for both roles, including guessed IDs and foreign channel headers. Seller order projections exclude other sellers' lines, financial records and private receipts. Existing products/orders remain store-owned; no historical prices or invoices are rewritten. Central administration alone confirms cash/bank collection and refunds. Phone and transfer verification gates still precede dispatch. Public descriptions are sanitized and image uploads are bounded, normalized images.

Each seller has a native Seller, child Channel and stock location, but no financial sub-order is created. Customer delivery requires exactly one method per seller plus any store-owned items. Checkout shows separate fees and native tax calculations. A server transition guard blocks incomplete delivery selection even through direct native API calls. Native 3.8 multi-shipping selection is rebuilt atomically only in an authenticated customer's unplaced AddingItems cart when its shipping-line count changes; placed orders are never reset.

## Integration guidance

Deploy the backend and Dashboard together first, then deploy the customer storefront. Both builds are required before creating/publishing seller catalogs. Startup runs the additive MarketplaceAccess1794614400000 migration: three sv_marketplace tables and one internal nullable Product owner field. Back up normally; do not run migration down on production, as it removes ownership/audit data. No role is assigned to existing accounts and no credentials are seeded. From the actual store channel, SuperAdmin opens Store → Selling workspace → Team & sellers to create a new Admin; Admin can create limited seller accounts. Never add native catalog/order/settings permissions to seller roles. See SHOP-MARKETPLACE.md for setup, tax policy, cash/refund confirmation and limitations.

## Verification

Run root tests, lint, types, upgrade validation and production build; backend types/server/Dashboard builds; real MySQL marketplace isolation and mixed-cart tests and production Chromium Dashboard tests. Exercise cross-seller/store IDs and role-escalation attempts, image ownership/HTML sanitization, stock edits/concurrency, all-delivery coverage, draft 3→2→1 shipping recalculation, central-only collection/refunds, partial seller fulfillment and seller deactivation. Re-run existing operations, Arabic checkout and governorate Dashboard browser regressions against disposable MySQL.
