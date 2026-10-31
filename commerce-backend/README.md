# Skillverse Global Commerce Backend (Vendure 3.8)

The Next.js storefront remains in the repository root and is deployed independently to Hostinger. This folder is a **separate Vendure server application**, with a background Worker and the official **React Dashboard**, which cannot be deployed just by pointing Hostinger's Next.js deployment at the repo root.

**Current status: backend source and initial MySQL schema migration prepared and tested against disposable MySQL 8; not deployed; no Hostinger production database touched; no actual users created.**

## Systems prepared

- Vendure Shop API at `/shop-api` for the Next.js storefront
- Vendure Admin API at `/admin-api`
- Official Dashboard bundle at `/dashboard/` after building it
- Worker with database-backed job queue and search indexing
- MySQL database configuration (target name `u169469823_store`)
- Supplier/INEX custom fields on products and variants
- Separate Egypt/Egyptian-pound channel, warehouse and channel-scoped role provisioning script
- A cautious initial Egypt data file with three EGP prices and **zero placeholder physical stock** (quantity is unknown and must be verified)
- Five additional INEX SKUs as a pending-price supplier manifest; no paid backorders enabled
- No active payment method or production email service until a verified local merchant and SMTP/payment provider are configured

## Database safety

**Do not run setup commands on a shared or non-empty database.** First check in phpMyAdmin that `u169469823_store` is empty or dedicated solely to Vendure, and take a backup. The database name alone is not enough to connect. A working MySQL connection needs a **host, username, and password**. For a backend hosted in the **same Hostinger hosting account**, try `127.0.0.1`; remote access rules apply only when the backend runs elsewhere.

Vendure's TypeORM `synchronize` is fixed at `false`. A production installation needs an approved **initial migration**. The initial migration is now committed under `src/migrations/` and has been applied successfully against disposable MySQL 8 by GitHub Actions. Verify the actual Hostinger database engine/version and review the migration before running it on the real database. The Vendure CLI `npx vendure migrate --generate initial --from-empty` uses a shadow database and therefore needs `CREATE DATABASE` privileges. Shared Hostinger MySQL users may not have that privilege, so generate the initial migration against a separate local MySQL database or controlled server, commit it, then apply to the real empty Hostinger database. On MySQL some DDL cannot be transactionally rolled back, so backups are mandatory.

**Never set `synchronize=true` in production to work around the missing initial migration.**

## Install and configure

From the `commerce-backend/` directory on a trusted local development environment or the Hostinger Node.js backend website:

```bash
npm install
cp .env.example .env
```

Set all values in `.env` locally (or in deployment environment settings) and keep the file **out of GitHub**. Use Node.js 22.12+; for production set `APP_ENV=production`.

Required backend server runtime variables:

| Name | Description |
|---|---|
| `DB_NAME` | `u169469823_store` |
| `DB_HOST` | `127.0.0.1` when the backend and MySQL share the same Hostinger hosting account |
| `DB_PORT` | Typically 3306 |
| `DB_USERNAME` | Hostinger MySQL user |
| `DB_PASSWORD` | Secret stored in the deployment platform |
| `DB_SSL` | `false` for local Hostinger MySQL; verified TLS may be required for remote connections |
| `SUPERADMIN_USERNAME` | Admin login chosen by owner, ideally their own email |
| `SUPERADMIN_PASSWORD` | Unique strong initial admin password (20+ characters) |
| `COOKIE_SECRET` | Secure random session secret (32+ characters) |
| `BACKEND_PUBLIC_URL` | Backend HTTPS domain |
| `STOREFRONT_PUBLIC_URL` | `https://shop.skillverse-global.com` |
| `ASSET_URL_PREFIX` | Public backend assets URL with trailing slash |
| `CORS_ORIGINS` | Allowed origin(s), comma-separated |

We are **not using Railway**. See `HOSTINGER-DEPLOY.md` for the planned separate Hostinger Node.js website. Local MySQL typically needs no public remote access; don't enable 'Any Host'.

## Deployment services (single-process pilot or separate-worker mode)

The low-volume pilot may run the SQL-backed job queue on the API process by setting `RUN_JOBS_IN_SERVER=true`. This avoids a separate Worker service but can reduce API responsiveness when there are long jobs. Vendure's long-term recommended production configuration is a separate Worker process. Attempt the pilot on a **second Hostinger Business Node.js website**, without modifying the existing Next.js shop:

- **API service:** install dependencies → build server → build dashboard (when an API for schema introspection is available) → `npm run start`
- **Pilot mode:** one API service with `RUN_JOBS_IN_SERVER=true`, no second Worker service.
- **Scaling mode:** set `RUN_JOBS_IN_SERVER=false` on the API, then add a Worker service with the same codebase/credentials and `npm run start:worker`.

Create a **separate Node.js website** for Vendure; keep the existing Next.js storefront website connected to the repository root. Hostinger web hosting does **not** guarantee always-running background jobs; test in-process job behavior before launch.

```bash
npm run check
npm run build
# Requires database, migration and running API:
npm run dashboard:build
npm run start
npm run start:worker  # only for separate-worker mode; not in single-process pilot
```

A `dist/dashboard` folder is required for the admin UI. Backend API compilation without a built dashboard is **not** a working dashboard deployment.

After everything has been configured, the admin is served at `https://BACKEND-DOMAIN/dashboard/`. The frontend connects to `https://BACKEND-DOMAIN/shop-api` with the correct country Channel token.

## First-time provisioning (do not skip order)

1. The owner confirms that **`u169469823_store` is a new empty database**. Once the new backend website is prepared, run `npm run db:check` from its authorized environment to verify that independently (read-only), and take a backup before migration. If both are on Hostinger, use `127.0.0.1` as DB_HOST.
2. Review the committed `src/migrations/1793467748993-initial.ts` migration. GitHub Actions generated it and successfully applied it to disposable MySQL 8. Apply it on the real database via `runMigrations()` only after authorized deployment and a verified database backup.
3. Configure `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` privately in the deployment environment, and run `npm run seed:initial` **once** with `ALLOW_INITIAL_SEED=YES_EMPTY_DB_BACKED_UP`. No account credentials should ever be committed. The Vendure system will initialize the first SuperAdmin using the configured values.
4. Start the Vendure API with `RUN_JOBS_IN_SERVER=true` and **no separate Worker**, and serve the official Vendure Dashboard.
5. Set the **actual legal selling agent name** `EGYPT_SELLER_LEGAL_NAME` and `ADMIN_API_URL` (e.g. `https://BACKEND-DOMAIN/admin-api`) plus superadmin secret credentials in a private shell. Run the provisioning script in dry-run mode:

```bash
node scripts/provision-egypt.mjs
```

6. Apply it **only when the dry run is correct**, setting `PROVISION_APPLY=YES_I_APPROVE_EGYPT_SETUP` on that one execution. This creates an Egypt EGP Channel, seller, local stock location and two channel-scoped roles.
7. Optionally add `EGYPT_AGENT_ADMIN_EMAIL`, `EGYPT_AGENT_ADMIN_PASSWORD`, `EGYPT_AGENT_FIRST_NAME`, `EGYPT_AGENT_LAST_NAME` in a private shell to create one Egypt operations admin. It does **not** create invented employees or share passwords via chat.
8. Use the official Dashboard to review country permissions, stock locations, local EGP currency, and manually import the **three priced products** from `catalog/egypt-inex-priced.csv`. The CSV uses **0 stock by default**, to prevent overselling; update each SKU to its physically verified quantity in the Dashboard before permitting sales.
9. Obtain the Channel's real token from the Dashboard and configure the frontend's server-only `VENDURE_SHOP_API_URL` and `VENDURE_CHANNEL_TOKEN` for Egypt.
10. Configure a real Egypt merchant payment gateway, tax invoices, shipping rates, SMTP email, cancellations/returns and supported backorders. Only then consider enabling storefront checkout.

## Permissions design

The setup script provisions two **Egypt-scoped roles**:

- `skillverse-eg-order-operations`: order/customer operations; no global admin settings or master product publishing
- `skillverse-eg-catalog-inventory`: local catalog/stock edits (audit shared product behavior before assigning to agents)

A central Skillverse SuperAdmin can see all channels. Later countries get independent sellers, warehouses and roles. Channels do not alone provide complete payment, invoicing, tax or customer data isolation; this requires additional testing and local merchant integrations.

## Development status and unresolved configuration

- Actual credentials, server host and database contents **have not been provided or accessed**.
- The initial migration is committed and tested on disposable MySQL 8, but **has not been applied to Hostinger**.
- The worker and dashboard are source-level integrations. Builds are checked by GitHub Actions, but no production backend runtime has been deployed.
- Stock counts of the three products and the business identity of the local agent are not known.
- Supplier lead times, prices of five additional products, taxes, legal terms, shipping and payment gateway are pending.
- Customer email verification requires an SMTP-enabled EmailPlugin configuration; the storefront's account sign-up must not be enabled until this is complete.
- Storefront's current fake demo backend must be disconnected before live commerce.

## Official documentation

- https://docs.vendure.io/current/framework/extending-the-dashboard/getting-started
- https://docs.vendure.io/current/framework/core-concepts/channels
- https://docs.vendure.io/current/framework/developer-guide/importing-data
- https://docs.vendure.io/current/core/developer-guide/migrations
- https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/
- https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/

## Note: verified empty does not equal connected

The owner has confirmed the Hostinger database is new and empty; **this is not proof that the Vendure server can connect**. The migration is generated in CI on an unrelated MySQL instance. In the real deployment, host, username and password must be provided privately to the separate Hostinger backend website; when hosted in the same account, try `DB_HOST=127.0.0.1` and avoid exposing remote MySQL. Run `npm run db:check` first; it uses SELECT/SHOW only and refuses to proceed silently if tables already exist.

## Single-process support

For small initial order volumes, set `RUN_JOBS_IN_SERVER=true` on the API process. It calls `JobQueueService.start()` after bootstrap and runs scheduled tasks on the API too. It continues using `DefaultJobQueuePlugin` with SQL-backed persistence. **Do not launch a separate worker while this setting is true**. Refer to `HOSTINGER-DEPLOY.md` for the one-service Hostinger pilot. This does not guarantee reliable long-running background processing on Hostinger Business, which explicitly does not support always-on background workers. Do not enable real checkout until the combined queue and restart behavior is verified on the actual Hostinger account.
