# Skillverse Vendure — Hostinger Business (no VPS / no Railway)

**Status:** deployment guide for a low-volume **pilot** only. No live database, domain, or real users have been modified or created by the GitHub code changes.

## Our selected deployment

- **Existing Hostinger Node.js website:** `shop.skillverse-global.com` — Next.js storefront, keep as-is.
- **Second Hostinger Node.js website:** `api.skillverse-global.com` (proposed subdomain, not created) — Vendure Admin/Shop API + Dashboard.
- **MySQL in same Hostinger hosting account:** `u169469823_store`, which the owner confirms is new and empty.
- **Single process:** `RUN_JOBS_IN_SERVER=true` executes Vendure job queue tasks on the API process; do not deploy the optional separate Worker. This is for testing and low-volume pilot only.

Hostinger's current documentation supports multiple separate Node.js websites and app roots on Business hosting, plus local MySQL access using `127.0.0.1`. However **Hostinger explicitly does not support always-running background workers or timers on web/cloud hosting**. Vendure combined processing *may* run while its API process stays alive but **is not a guaranteed durable production queue executor on this plan**. Treat task execution, search indexing, sending email, restart recovery and uptime as acceptance tests before taking any real orders.

Hostinger references:
- https://www.hostinger.com/support/how-to-add-a-node-js-web-app-at-hostinger/
- https://www.hostinger.com/support/how-to-deploy-monorepos-with-npm-yarn-or-pnpm-on-hostinger/
- https://www.hostinger.com/support/hostinger-node-js-limits-for-web-and-cloud-plans/
- https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/

## Before connecting the database

1. Verify in hPanel that the actual database engine/version is compatible with Vendure's MySQL driver and the generated baseline migration. The schema was generated and tested against **MySQL 8**, whereas Hostinger sometimes uses a MariaDB-compatible engine.
2. Take a database snapshot/backup before applying the first migration, even if empty.
3. Keep credentials **only** in Hostinger Environment Variables / private secrets. Never send DB_PASSWORD, COOKIE_SECRET, or admin passwords in a chat, GitHub issue, PR or commit.
4. Use Hostinger **Databases → phpMyAdmin** to verify this database has **zero tables** before its first deployment. The optional `npm run db:check` CLI also performs read-only checks, but Hostinger does not support running Node app npm scripts over SSH.
5. Do not enable any public checkout or customer registration before stock, merchant, email and payment settings have been tested.

## Add a *new* Node.js website in Hostinger

In Hostinger **Websites → Create site → Web App → GitHub Integration**:

- Repository: `Ahmedaboelela1/E-Commerce`
- Choose `main` **after** the approved PR is merged.
- Root directory: `commerce-backend` (choose only this subproject, not the entire Next.js app).
- Framework: Node.js / Other if auto-detection does not identify Vendure.
- Node.js version: 22 or newer.
- Build command: `npm run build && npm run dashboard:build`
- Output directory: `dist` (Hostinger may require this for the "Other" app type).
- Entry file: `dist/index.js` when Hostinger requests one.
- Start command if exposed: `npm run start`.

**Important:** This is a planned configuration and has not been verified on this specific Hostinger account. The `dist/dashboard` assets must remain present at runtime for `/dashboard/` to work. If Hostinger excludes non-JavaScript assets on deployment, a custom deployment copy step may be necessary; inspect build logs before assuming success.

### Proposed secrets

Set the following keys on the **new backend Node.js website only**:

```dotenv
APP_ENV=production
RUN_JOBS_IN_SERVER=true
# FIRST DEPLOYMENT ONLY: remove this variable after successful setup.
HOSTINGER_INITIALIZE_COUNTRIES=YES_NEW_EMPTY_DATABASE

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=u169469823_store
DB_USERNAME=<full MySQL user from hPanel>
DB_PASSWORD=<secret in hPanel>
DB_SSL=false

COOKIE_SECRET=<unique random 32+ character secret>
SUPERADMIN_USERNAME=<owner-selected private admin identifier>
SUPERADMIN_PASSWORD=<unique random 20+ character password>

BACKEND_PUBLIC_URL=https://api.skillverse-global.com
STOREFRONT_PUBLIC_URL=https://shop.skillverse-global.com
ASSET_URL_PREFIX=https://api.skillverse-global.com/assets/
CORS_ORIGINS=https://shop.skillverse-global.com,https://api.skillverse-global.com
```

`127.0.0.1` is the hostname recommended by Hostinger **when the Node app and database are hosted together in the same hosting account**. Do not use `localhost` in newer Node releases, due to potential IPv6 `::1` authentication failures. If Hostinger actually places the Node app and database in separate environments, check host connectivity and configure the provider-issued hostname accordingly.

## Schema initialization and first user

The committed initial migration is `src/migrations/1793467748993-initial.ts`. It has been tested successfully against **disposable MySQL 8**, but *has not been run on Hostinger*. Its actual database engine/version must be checked in phpMyAdmin first; if the engine differs materially, do not run the migration until compatibility has been verified.

The owner confirmed this database is new and empty and approved starting Vendure. After the phpMyAdmin check and backup, the app's first start can:

1. Apply the **committed, tested migration** (this is intentionally not the TypeORM `synchronize` mode).
2. Bootstrap Vendure and create the first SuperAdmin from the private `SUPERADMIN_USERNAME` and `SUPERADMIN_PASSWORD` values.
3. If `HOSTINGER_INITIALIZE_COUNTRIES=YES_NEW_EMPTY_DATABASE`, populate only the three country/zone entries (Egypt, Saudi Arabia and Tunisia), once. Further restarts see existing countries and skip this seed.
4. Show the backend Dashboard at `https://api.skillverse-global.com/dashboard/` (use the actual assigned URL if a temporary Hostinger domain was chosen).

**After verifying the countries and Admin login, REMOVE `HOSTINGER_INITIALIZE_COUNTRIES` from the environment and restart.** No default passwords or API-accessible setup routes are created. Country-agent admins, real stock, payment and shipping must be configured separately.

Hostinger says npm commands are performed during deployment and cannot be invoked via SSH on its managed Node.js hosting. The opt-in first-start country seed avoids requiring that unsupported command. The optional original `npm run seed:initial` CLI exists for controlled development but should not be run as well if the first-start seed is used.

## Preconditions before real sales

- Verify the combined job queue and scheduled tasks continue working after Hostinger redeploy/restart or idle behavior. SQL-backed queued jobs persist, but they are only processed while the app runs.
- Verify the Admin Dashboard is served and authenticated correctly over HTTPS.
- Verify durable, backed-up image storage; the default local uploads directory is not guaranteed to survive web-app redeployments.
- Import the INEX products, set physical stock units for all three initially in-stock SKUs, assign Egypt channel and EGP price, and check isolation of agent permissions.
- Configure a legitimate merchant of record, Egypt taxes, payment gateway, shipping, invoice, email delivery, returns and operational monitoring.
- Keep `NEXT_PUBLIC_ENABLE_CHECKOUT=false` in the Hostinger storefront until these checks pass.

## Status

This guide does **not** mean the backend is now running on Hostinger; it documents the path to try without Railway or VPS. If Hostinger's shared platform fails the job queue/restart or deployment checks, do **not** bypass them to take orders: use a supported persistent process host later or keep the storefront in catalog-only mode.
