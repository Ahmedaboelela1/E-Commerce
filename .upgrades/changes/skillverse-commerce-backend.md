---
type: minor
areas:
  - tooling
---

## Intent

Add a separate Vendure 3.8 MySQL commerce backend inside `commerce-backend/` for the Skillverse Global multi-country store, without changing the existing Next.js storefront runtime.

## Invariants

- The root Next.js storefront remains independently deployable.
- No credentials or real users are written to version control.
- No schema synchronization, payments, or stock adjustments are allowed automatically on the Hostinger database.
- Country users must be scoped through Vendure roles and country Channels.
- The separate Vendure API and background worker require dedicated persistent hosting.

## Integration guidance

- Deploy the new backend as its own service, separate from the Hostinger Business-hosted frontend.
- Generate and review an initial schema migration in a safe disposable MySQL environment before connecting the target database.
- Use the official Dashboard and approved merchant data to configure country-specific taxes, payments and shipping.
- Review the backend README and GitHub Actions checks when integrating the backend.

## Verification

- GitHub Actions checks Node.js provisioning script syntax and Egypt catalog stock/pricing invariants.
- Run `npm install`, `npm run check` and `npm run build` in `commerce-backend/`.
- Build the official Dashboard against a running staging Vendure API and verify admin sign-in, channel permissions and per-country stock isolation.
