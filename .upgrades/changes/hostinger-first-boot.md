---
type: minor
areas:
  - tooling
---

## Intent

Support one-time Vendure country/zone initialization during the first backend start on Hostinger Business managed Node.js hosting, where npm app scripts cannot be run manually via SSH.

## Invariants

- Never expose an HTTP route that performs initialization.
- Require explicit private environment variable `HOSTINGER_INITIALIZE_COUNTRIES=YES_NEW_EMPTY_DATABASE`.
- Skip if any country data already exists; do not invent inventory, orders, payments or customer credentials.
- Keep Next.js storefront separate and unaffected by backend startup logic.

## Integration guidance

- Use an empty dedicated, backed-up MySQL database verified in Hostinger phpMyAdmin.
- Build the separate Node.js website from `commerce-backend` and set credentials only in Hostinger secret environment variables.
- Remove the setup flag after the initial country/zone initialization.
- Keep checkout disabled until merchant, mail, payments, stock, shipping and queue reliability are tested.

## Verification

- GitHub Actions builds the backend and official Dashboard.
- The isolated MySQL 8 first-boot integration test applies committed migrations, starts Vendure, and checks SuperAdmin and country setup.
- Inspect Hostinger deployment logs before enabling customer-facing features.
