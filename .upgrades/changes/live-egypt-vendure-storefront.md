---
type: minor
areas:
  - tooling
---

## Intent

Connect the customer-facing Next.js storefront to the already-installed Skillverse Vendure Egypt channel, without allowing incomplete ecommerce orders.

## Invariants

- The actual Shop API and Channel Token are configured **only in Hostinger environment variables**, not committed to GitHub.
- Allowlist Vendure's HTTPS asset host for Next.js images.
- Use products from the current channel rather than hardcoding upstream demo's 'electronics' collection.
- Ignore stale demo currency cookies incompatible with the EGP-only channel.
- Keep purchase/checkout action disabled by default until real stock, payment, shipping, tax and email operations are configured.

## Integration guidance

The rollout needs an **independent deployment of the existing shop application**. Do not change the already-working Vendure backend just to switch customer-facing API connection. See `docs/hostinger-egypt-storefront-connection.md`.

## Verification

Root Next.js lint, types, tests, production build. Manual Hostinger staging test with the Egypt Channel token and one zero-stock INEX robot product.
