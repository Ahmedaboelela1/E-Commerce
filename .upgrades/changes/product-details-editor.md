---
type: minor
areas:
  - products
  - tooling
---

## Intent

Add a separate English and Arabic rich-text Details section to the marketplace product editor and product page.

## Invariants

Details use the product’s existing seller and store access checks. Omitted details are preserved on updates. The server sanitizes formatted content before storage. The Arabic storefront uses English details when the Arabic field is empty.

## Integration guidance

Deploy the backend and Dashboard with the ProductDetails migration, then the storefront. Existing products acquire two nullable text fields. Authors can insert an image from the product gallery, format paragraphs and lists, and add headings.

## Verification

Save a formatted product from the Products tab and reopen it. Check the English and Arabic product pages, including products with empty details and products with details but no specifications.
