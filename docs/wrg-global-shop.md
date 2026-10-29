# WRG Global Shop — Project foundation

**Project owner:** Skillverse Global  
**Storefronts:** WRG country websites (currently Next.js, hosted on one Hostinger Business Web Hosting subscription)  
**Product focus:** INEX robotics and education products, accessories, spare parts, and WRG competition-related bundles.

## What this repository is

This repository is a **fork of Vendure's Next.js storefront starter**. It contains a customer-facing storefront, **not the Vendure Commerce Server** or a central inventory/procurement backend. A working Vendure Shop API must be provisioned separately before real purchases can operate.

Do not replace any existing WRG national website with this repository without an integration plan.

## Confirmed business boundaries

- Each country's **local authorized agent** is the merchant/seller of record, imports the goods, invoices customers, collects payments, handles fulfillment and local compliance.
- Skillverse Global governs the INEX master catalog, authorized product distribution, oversight dashboards, stock visibility, and purchasing coordination.
- Neither a shared customer list nor unrestricted cross-border inventory selling is implied by central oversight.
- Country agents can access only permitted local store, stock, customers, orders, invoices and payment settings.
- Maintain an auditable record of pricing, stock, ordering and permissions changes.

## Intended architecture

```text
WRG Egypt Next.js         WRG Country N Next.js
     /shop                         /shop
        \                        /
         \      Vendure Shop API /
          ------ Commerce Server -----
                    |
          Country-specific Channels
          Prices / currency / payments
          Stock locations / allocations
          Agent permissions / orders
                    |
          Skillverse Central Dashboard
          INEX catalog + replenishment
          Supply lead time + purchasing
```

Vendure **Channels** are a starting point for country segmentation, **not by themselves a guarantee of complete legal, payment, customer, or inventory isolation**. Confirm these boundaries in integration tests before production use.

## Essential capabilities

1. Reuse product metadata, images, variants and SKUs across authorized country storefronts.
2. Configure country-specific products, local prices, taxes, currency, delivery options, and payment providers.
3. Keep stock by warehouse and market; never pool sellable availability across local agents automatically.
4. Reserve stock transactionally and prevent overselling between simultaneous carts/orders.
5. Support **Available on Order** for selected SKUs only, with configurable lead-time estimate, supplier confirmation rules and clear cancellation/refund policy. Never show an estimated delivery date as guaranteed.
6. Have a separate **Pre-order** status for confirmed future availability, and a **Notify me** flow for items that cannot be ordered.
7. Aggregate local agent procurement needs into proposed INEX purchase orders without mixing end-customer invoices across agents.
8. Provide a **Shop by WRG Competition** catalog subject to current official rules.
9. Ensure all customer orders, payment settlements and legally required invoices are handled for the correct local seller.

## Phased build

### Phase 0 — Proof of concept (no production payments)

- Run a Vendure server and worker on a suitable managed Node.js service or VPS, with a persistent database.
- Point this storefront at its Shop API using server-side environment variables.
- Configure two isolated pilot Channels (e.g., Egypt and Saudi Arabia) with **test** payment providers.
- Import 10 sample INEX SKUs after verifying descriptions and rights to product photos.
- Test price, stock, order, customer-access and payment separation by country.
- Test out-of-stock ordering with a visible non-guaranteed supply estimate.
- Do not turn on payment collection until the appropriate local agent has approved terms, merchant account, tax/invoice handling and return policy.

### Phase 1 — WRG Egypt pilot

- Launch a staging storefront with WRG identity, categories, cart and checkout.
- Define INEX delivery/stock sync and central admin permissions.
- Add a single production country after security, data-isolation and payment acceptance tests.

### Phase 2 — Multi-country scale

- Add more countries and agents through configuration rather than duplicate implementations.
- Build procurement aggregation, warehouse transfer workflows, agent reporting, and alerts.

## Integration with existing Next.js WRG sites

The starter is a **standalone Next.js application**. Deploying it to `shop.wrgegypt.com` is the quickest safe trial. Showing it seamlessly under `wrgegypt.com/shop` requires integrating the storefront routes and commerce modules into the existing WRG Next.js application (or routing infrastructure); deployment alone does **not** achieve this.

Reuse the common storefront features without moving the existing competition pages.

## Security and operations

- Keep all credentials in Hostinger/hosting environment settings, never GitHub.
- Use per-environment API tokens, role-based server-side access and HTTPS.
- Never store payment card details in the storefront or central dashboard.
- Validate isolation on every API operation and keep audit logs.
- Backup the Vendure database, media and configuration before production rollouts.
- Separate staging from production; require a production readiness review.

## Next document

See [Hostinger deployment checklist](./hostinger-deployment-wrg.md).
