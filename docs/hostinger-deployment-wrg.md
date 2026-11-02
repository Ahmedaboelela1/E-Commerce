# Deploy this storefront to Hostinger Business (WRG pilot)

This guide covers **only the Next.js storefront in this repository**. It does **not** deploy Vendure Server, its background worker, database, or a Skillverse central dashboard.

## Prerequisites

- A Hostinger Business Web Hosting subscription with an available **Node.js application slot**. Hostinger currently limits Business plans to **5 Node.js websites** total; review existing apps before adding another.
- An operational, reachable Vendure **Shop API** for a **staging** environment, with a configured country Channel and test products. Without it, real catalog/cart/checkout operations cannot work.
- A staging domain/subdomain, e.g. `shop-staging.wrgegypt.com`, not a live national WRG site.
- Access to `Ahmedaboelela1/E-Commerce` and the Hostinger hPanel.

## Important hosting division

| Component | Where |
| --- | --- |
| This Next.js storefront | Existing Hostinger Business Web Hosting, if an app slot and sufficient resources remain |
| Existing WRG country websites | Keep current Hostinger deployments untouched |
| Vendure API, long-running worker, database | Separate suitable managed platform or VPS |
| Skillverse central purchasing / monitoring | Build separately after the pilot |

Hostinger shared Business Node.js hosting does **not** support always-running background worker services. Do not assume the frontend alone can manage inventory, fulfill orders or act as the commerce backend.

## Step-by-step staging deployment

1. Open **Hostinger hPanel → Websites → Add website → Node.js Web App** (wording can vary).
2. Choose **Import Git repository** and select `Ahmedaboelela1/E-Commerce`.
3. Select the desired verified branch (prefer `main` for stable deployments; use a staging branch for testing).
4. Choose **Next.js**, Node.js **22.x** (or another runtime version supported by the project's dependencies and Hostinger).
5. Review the platform-detected build commands. This repository provides:
   - Dependency install: `npm ci`
   - Build: `npm run build`
   - Start: `npm run start` (if Hostinger requires its injected port, configure the platform-compatible start command).
6. Configure **environment variables in hPanel**. Start with the values described in `.env.example`; do not upload your local `.env.local` or commit real credentials.
7. Deploy, check build logs, then test product pages, account sessions, cart, checkout in **test mode**, and order visibility in the Vendure admin.
8. Monitor account Resource Usage (CPU, memory, entry processes, max processes), especially while existing WRG sites run on the same subscription.

## Production environment values

```dotenv
# Server-only endpoint of the separately deployed Vendure backend
VENDURE_SHOP_API_URL=https://YOUR-VENDURE-BACKEND.example/shop-api

# Target local-agent channel: use the actual token configured in Vendure
VENDURE_CHANNEL_TOKEN=YOUR_COUNTRY_CHANNEL_TOKEN

# The URL of this storefront, not the admin dashboard or existing WRG root
NEXT_PUBLIC_SITE_URL=https://shop-staging.wrgegypt.com
NEXT_PUBLIC_SITE_NAME=WRG Egypt Shop

# Generate a unique strong secret, do not use a value from this document
REVALIDATION_SECRET=GENERATE_A_RANDOM_SECRET
```

These are placeholders **only**; none are active services or credentials. Keep country selection on the server side and validate it against authorized hostnames. Do not expose admin/API secrets through `NEXT_PUBLIC_*` variables.

## Before launching real orders

- Verify the endpoint uses HTTPS and the correct country's Vendure Channel.
- Validate login/session persistence with secure cookies and custom domain configuration.
- Test order creation, shipping, taxes, cancellations, refunds and **local-agent** payment integration; do not collect real payment until these work.
- Verify country-by-country boundaries for account profiles, products, stock, orders, customer records and invoices.
- Test out-of-stock behavior and estimated delivery messaging. The storefront starter **does not** automatically provide Skillverse's custom lead-time/procurement workflow.
- Review images configuration in `next.config.ts`: add the real Vendure assets host; remove unsafe local-IP allowances if not needed for production.
- Ensure there is an order support contact and the legal terms of the actual local selling agent.
- Confirm backup strategy, basic monitoring and operational ownership.

## Known limits

- A standalone storefront on a subdomain **is not automatically** a `/shop` section in an existing Next.js WRG codebase. That needs code-level integration/reverse routing.
- This repo does not include the commerce backend; Hostinger connection by itself will not populate products or enable real checkout.
- The central multi-agent dashboard, consolidated INEX ordering, per-country procurement and supplier lead-time calculations must be built and tested.
- The Hostinger Business account is shared with existing national WRG sites; app counts and resource usage may require a different storefront deployment arrangement.

## Official references

- [Hostinger: Deploy a Node.js website](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/)
- [Hostinger: Node.js hosting limits](https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/)
- [Vendure starter README](../README.md)
- [WRG Global Shop architecture](./wrg-global-shop.md)
