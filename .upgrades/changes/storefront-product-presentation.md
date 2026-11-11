---
type: minor
areas:
  - products
  - commerce
  - search
  - site
---

## Intent

Make wishlist hearts visible on every product tile and beside the product title, and refresh the storefront with an actual catalog spotlight, a compact product grid and uncropped product images.

## Invariants

The official Skillverse logo and brand colors remain. Prices, stock, variant selection, checkout and account ownership still come from Vendure. Image failures use a clear placeholder. No mock product images, inflated catalog counts, free-shipping promises or invented discounts are displayed. Favorites reuse the existing account-backed operations feature. Shipping remains manual.

## Integration guidance

Deploy the storefront from the same current backend release that includes the operations plugin. Product cards, related products, saved products and catalog listings share the presentation component. The spotlight uses cached catalog data; the featured grid loads through a same-origin catalog endpoint with a loading state, error recovery and a link to the server-rendered full catalog. Small catalogs use a centered grid rather than empty columns. New text is registered in English and German. Do not reintroduce the starter's unverified free-delivery copy.

## Verification

Run upgrade validation, architecture/i18n/unit tests, lint, types and production build. Exercise product cards and detail favorite toggles, reload persistence, guest sign-in, mobile layout and image failure/thumbnail controls against the isolated local Vendure fixture.
