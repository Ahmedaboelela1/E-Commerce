# Skillverse Commerce Hub — Pilot Dashboard

## What has been implemented

A **staging-only dashboard preview** inside the existing Next.js storefront, located at:

- `/en/admin-preview`
- `/de/admin-preview`

Enable it only on an isolated staging deployment with server environment variable:

```dotenv
SHOW_ADMIN_PREVIEW=true
NEXT_PUBLIC_ENABLE_CHECKOUT=false
NEXT_PUBLIC_SITE_NAME=Skillverse Global Shop
NEXT_PUBLIC_SITE_URL=https://YOUR-HTTPS-STAGING-DOMAIN
```

Important: **SHOW_ADMIN_PREVIEW is only a visibility switch, not authentication.** All records currently displayed are public product catalog data; do **not** add customer details, financial figures or private inventory into this page. Disable this variable on the production store after validating the preview.

No real store stock updates or payments are enabled.

## Functional preview modules

| Module | Prototype state |
| --- | --- |
| Overview | Verified catalog counts only (8 SKUs, 3 reported in stock in Egypt, 5 on request) |
| Products | Search, filter, real supplier SKU references and manufacturer descriptions |
| Inventory | Temporary draft for local price, actual quantity and estimated supplier lead time |
| Orders | Backend connection required; no sample transactions fabricated |
| INEX Procurement | Draft sourcing workflow; no purchase orders created |
| Export draft CSV | Downloads temporary draft values for review/import planning |

The quantity entered in a browser tab **is not persisted**. Download the CSV before navigating away. Do not treat downloaded CSV values as physical stock until checked by the selling agent.

## Product assets

- Official INEX product pages are the canonical product-data source.
- `/api/inex-photo?sku=...` fetches the allowlisted INEX product URL at runtime and reads image metadata, then redirects the browser to the manufacturer's official HTTPS image.
- If INEX changes its markup, blocks image hotlinking or its site is offline, the branded `inex-image-fallback.svg` is shown.
- The image service does **not** crawl on a recurring schedule or copy assets to GitHub.
- For production reliability and permission controls, download approved original product images into the Vendure asset library once the supplier authorizes storage/redistribution.

## Real administration (not yet connected)

Deploy a standalone **Vendure Server + worker + database** on a suitable hosting environment. The official Vendure Dashboard serves as the primary secured administration interface; Skillverse-specific procurement and multi-agent views can be implemented as extensions.

Recommended country model:

1. Central master product catalog with stable INEX SKUs and supplier URLs.
2. One selling-agent Channel per country; separate legally required merchant, currency, local tax, payment, shipping and returns.
3. Country-specific stock locations, reservations, stock adjustments and restricted access.
4. Explicit `AVAILABLE_ON_ORDER` policy with supplier lead time, quantity caps, cancellation and refund terms.
5. Procurement requests aggregate needs *without* silently selling stock belonging to another agent.
6. Permissions and audit logging tested before real customer data.

## Before accepting payments

- Confirm local Egypt agent's legal seller identity and payment-account ownership.
- Verify actual quantity of each of the three reported locally stocked kits.
- Confirm if SumoBOT standard SKU 8300153 is **ATX2i** (as on official INEX website) or a locally customized variant.
- Verify manufacturer media distribution permission and image reliability.
- Implement server-side authentication, audit logs, rate limiting and permission tests.
- Connect Vendure, monitor workers and database backups, configure gateway credentials outside Git.
- Review the npm audit findings and fix actionable vulnerabilities.

## Deployment

1. Review PR #2, including its change note, and inspect build/test checks.
2. Preview in a staging Hostinger deployment, **not the existing WRG country websites**.
3. Deploy the new branch there and configure `SHOW_ADMIN_PREVIEW=true`.
4. Open `https://STAGING-DOMAIN/en/admin-preview` and use Export draft CSV to collect inventory figures for Egypt.
5. Once a real Vendure backend is running, migrate product data into Vendure and replace preview state with server-backed operations.

No personal secrets or credentials should be committed to this Git repository.
