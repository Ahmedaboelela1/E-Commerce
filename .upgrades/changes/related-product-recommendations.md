---
type: minor
areas:
  - products
---

## Intent

Show a compact, responsive recommendation grid on every product detail page, preferring actual shared catalog collections and using a clearly labelled general-catalog fallback when no related alternatives exist.

## Invariants

Exclude the current product, deduplicate by product ID and limit the grid to four real visible products in the active channel, currency and language. Keep existing wishlist hearts and comparison controls. Do not invent relatedness, products, prices or stock. An empty catalog of alternatives or failed recommendation request must not break the product page.

## Integration guidance

Deploy the storefront. Manage actual grouping using native Catalog Collections; no new backend migration or merchant settings are required. A product without alternatives has no recommendation section. The same-origin public endpoint validates the visible source product and never uses customer authentication.

## Verification

Run storefront tests, lint, type checks, upgrade validation and the production build, plus the focused real-MySQL/Chromium recommendation suite for collection ranking, fallback, current-product exclusion, disabled products, channel boundaries and mobile layout.
