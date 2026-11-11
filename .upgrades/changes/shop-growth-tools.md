---
type: minor
areas:
  - commerce
  - products
  - account
  - cart
  - site
  - tooling
---

## Intent

Add real component-stock bundles, comparison from configured product specifications, school quotations, explicitly requested back-in-stock messages, returns/exchange case tracking, opt-in unfinished-cart reminders and per-product help resources.

## Invariants

Physical bundle components remain native stock-tracked order lines. A private, read-only order-line grouping key prevents customer-forged discounts and overlapping bundle components from sharing the same units. Native promotions, tax settings, stock checks and payment authorization remain authoritative. Coupon codes do not combine with bundle savings. Actual seller, product, resource, price and policy data must be configured by staff; missing specifications are not invented. A quotation is not an order or payment. Return resolution links a real settled refund, a placed replacement order, or a genuinely cancelled uncollected order; uploading photos does not refund or restock goods. Cart consent defaults off and one reminder per cart includes a signed unsubscribe link. Recovery never replaces a different current cart. Shipping integrations and cards remain deferred.

## Integration guidance

Deploy matching storefront, server and Dashboard. The additive migration creates nine feature tables and one nullable private OrderLine custom-field column; existing order prices and payments remain untouched. Back up first, keep synchronize false, and do not run migration down routinely. Configure PRIVATE_RETURN_DIR outside public assets and deployment folders. Native Dashboard provides Catalog tools for specifications/help/bundles and Customer care for quotes/returns/notification settings. Returns are disabled until staff supplies the actual return window; cart reminders are disabled until enabled by staff and individually opted into by customers. See SHOP-GROWTH.md for the consolidated owner checklist.

## Verification

Run all storefront architecture/i18n tests, lint, types, upgrade validation and production build, backend server/Dashboard builds and existing email/order regression suites. The isolated growth MySQL suite exercises real bundle component quantities and discounts, private-field spoof rejection, comparison/resource validation, real restocking, quote ownership and immutable acceptance, private return photos, actual settled-refund linkage, consent/no-consent reminders, deduplication, recovery and unsubscribe. Chromium tests cover the new customer and administrator routes on the built applications.
