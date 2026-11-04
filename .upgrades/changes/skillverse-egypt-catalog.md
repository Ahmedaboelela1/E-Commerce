---
type: minor
areas:
  - site
  - tooling
---

## Intent

Establish a Skillverse Global-branded INEX product catalog for the Egyptian pilot, with verified product metadata, safe retrieval of manufacturer images, and a staging-only commerce dashboard preview.

## Invariants

- The existing Vendure starter checkout and authentication flows are not represented as production payment operations until a genuine country-specific backend is connected.
- The manufacturer's official images are resolved only through allowlisted INEX product pages, with a fallback image if resolution fails.
- Egyptian stock is product-status-only until exact physical quantities are supplied; do not infer actual stock levels.
- The admin preview is read-only with temporary form drafts exported as CSV; it does not store or mutate inventory, customer records or orders.
- Country-agent ownership of invoicing, imports and funds remains separate from Skillverse central product oversight.

## Integration guidance

- Preserve the company logo from the Skillverse Global company repository.
- Keep `NEXT_PUBLIC_ENABLE_CHECKOUT=false` during the public catalog pilot and enable `SHOW_ADMIN_PREVIEW=true` only in a temporary staging deployment.
- Replace the draft CSV workflow with Vendure Admin API integration after a real server, worker, persistent database and secure administrator authentication have been provisioned.
- Maintain the real supplier URL for each INEX SKU; only show confirmed local prices and delivery estimates.

## Verification

- Review product SKU and EGP prices against user-provided data.
- Confirm public catalog pages show the INEX image when available and a safe fallback otherwise.
- Run `npm run upgrade:validate`, `npm test`, `npm run lint`, `npm run check-types`, and `npm run build`.
- Inspect country and checkout behavior before enabling payments.
