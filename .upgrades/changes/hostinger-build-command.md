---
type: patch
areas:
  - tooling
---

## Intent

Make the Hostinger Business monorepo deployment work with a single selectable build script.

## Invariants

- Vendure backend and its official Dashboard are compiled together with `npm run build`.
- Existing Next.js storefront remains unchanged.
- No changes to database, accounts, payments or hosting connection.

## Integration guidance

Set `Root directory=commerce-backend`, `Framework=Other`, `Build command=npm run build`, `Output directory=dist`, and configure the entry file for the server.

## Verification

Run the Commerce Backend and root storefront CI jobs before merging.
