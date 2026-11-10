---
type: patch
areas:
  - products
---

## Intent

Display the product's featured preview on the detail page, matching its working catalog card. Previously the gallery opened the first original source file, which could be unavailable even when a usable featured preview existed.

## Invariants

Keep the remaining gallery assets and omit the duplicate featured asset. Prefer preview URLs for display, falling back to source only when no preview URL is supplied. Preserve Next image optimization and its existing origin allowlist. This does not restore missing files or change backend storage settings.

## Integration guidance

Redeploy the storefront. The Shop API product query now includes featuredAsset, and the gallery and metadata prioritize it. Keep the API's persistent ASSET_UPLOAD_DIR setting and restore any additional missing files separately.

## Verification

Run upgrade validation, tests, lint, types and production build. Check the rendered main image uses preview and that product details prioritize the featured image, retaining other gallery assets without duplication.
