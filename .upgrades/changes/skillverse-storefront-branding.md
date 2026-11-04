---
type: minor
areas:
  - site
  - tooling
---

## Intent

Bring the customer storefront in line with the established **Skillverse Global** corporate identity, using the **original logo SVG** owned by the user's separate `skillverse-global` website, not a newly drawn approximation.

## Invariants

- Preserve all Vendure Shop API, Egypt-channel pricing, stock and checkout safeguards.
- Navbar and footer use the official mark and Skillverse navy `#102140` / blue `#2e5eab`.
- The favicon loads the same real company mark; remove the upstream Vendure ICO, avoiding conflicting per-locale icon routes.
- Footer links point to actual shop routes or the company's existing site and social address, not Vendure starter documentation.
- No database migrations, customer data, purchases or real Hostinger deployment.

## Verification

Root storefront build, lint, types and tests, plus branding smoke tests for the original SVG, navbar/footer, page icon metadata and removal of Vendure favicon.
