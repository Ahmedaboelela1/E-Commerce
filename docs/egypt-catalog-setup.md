# WRG Global Shop — Egypt initial product data

The pilot storefront has been branded using the Skillverse Global logo from the existing company repository.

## Verified first 3 products in Egypt

| INEX SKU | Product | Price (EGP) | Egypt local stock |
| --- | --- | ---: | --- |
| 8300158 | POP-BOT32i Soccer Robot Kit | 25,000 | Reported in stock; exact quantity unknown |
| 8300155 | POP-BOT32i Rover Kit Plus | 20,000 | Reported in stock; exact quantity unknown |
| 8300153 | Robo-Creator Xi: SumoBOT Kit | 25,000 | Reported in stock; exact quantity unknown |

Source product links are recorded in [the product manifest](../catalog/inex-egypt-pilot.csv).

## Further INEX items

Five additional verified INEX products are staged with **no Egypt price, no promised delivery date, and no claimed supplier inventory**. They appear as *on request* in the static catalog. This does not yet cover the complete INEX catalog.

The manufacturer catalog may include items unavailable from INEX; never advertise any on-request item as an accepted paid preorder until supplier feasibility, local import rules, timing, price, and refunds are confirmed.

## Open requirements

- Stock **quantity per SKU** for Egypt (product lines are not quantities).
- Actual legal seller name, shipping and refund policy, local payment gateway, tax treatment.
- Supplier-provided approved product photos, manuals, and any product marketing media reuse rights.
- **Robo-Creator Xi: SumoBOT Kit:** INEX's linked standard product describes an ATX2i control board. If the local stock is a customized POP-32i variant, create a separate SKU with verified contents — do not silently mislabel it.
- Configure Vendure commerce server + worker + database separately, and set up an **EGP** Egypt Channel and stock location.
- Import this manifest into Vendure via Admin API **only after** quantities, merchant and channel are confirmed. This CSV is a source manifest, not a ready-to-import Vendure-native schema.
- Implement controlled backorders and supplier lead-time model. Default checkout is disabled.

## Preview mode (important)

`NEXT_PUBLIC_ENABLE_CHECKOUT` is **disabled by default**. Public storefront only presents the manually verified catalog; protected commerce routes are redirected home until the real backend, local seller configuration and payment readiness review are complete.

Never connect a public shop to the read-only Vendure demo and advertise its sample products as real INEX inventory.

## Admin panel status

This repository is a **Next.js storefront**, not Vendure Server. There is **no real product/order admin panel running at this site**. Vendure's Dashboard is deployed with its Commerce Server, commonly at `/dashboard` on the backend host once configured. Do not create a fake standalone /admin page or ask users to store sensitive credentials in frontend env vars.

## Deployment

Deploy the PR after reviewing and CI/build checks. Keep `NEXT_PUBLIC_SITE_URL` fully qualified, e.g. `https://shop.skillverse-global.com` and set `NEXT_PUBLIC_SITE_NAME=Skillverse Global Shop` in Hostinger. Do not set `NEXT_PUBLIC_ENABLE_CHECKOUT=true` until a real backend and local agent payment/stock checks are complete.
