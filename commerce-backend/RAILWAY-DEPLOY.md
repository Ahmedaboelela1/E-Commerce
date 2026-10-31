# Deploy Skillverse Vendure on Railway (no Hostinger VPS required)

**State:** source and baseline MySQL migration are prepared in PR #3. This playbook does not imply that Railway, Hostinger DB, or any real admin accounts have been provisioned.

## Recommended first deployment: Railway API + Worker + Railway MySQL

We recommend running all three services in **one Railway project**, connected using Railway's *private network*. The existing Hostinger Business Next.js shop remains hosted at `https://shop.skillverse-global.com`.

Although the owner has an **empty Hostinger MySQL database named `u169469823_store`**, using Railway MySQL is simpler and does not require opening a public MySQL endpoint or buying Railway Pro for a fixed outbound IP. The empty Hostinger database is **not** automatically migrated or deleted; using Railway's database is a separate decision. Use only one primary database for the shop.

### Option B: Keep Hostinger database

If the owner specifically wants `u169469823_store` as the live database, Railway's official **static outbound IP** feature is on the **Pro** plan. Add each Railway service's assigned outbound IP to Hostinger's **Remote MySQL** allowlist (no Any Host / wildcard). Configure its full MySQL host, username, password and schema in Railway secret variables. Remote MySQL TLS support and firewall restrictions must be verified. An ordinary Railway service may not have a stable outbound IP.

**Do not enable Hostinger Remote MySQL 'Any Host' just to simplify deployment.**

## Railway project setup

1. In Railway, create a project named `Skillverse Commerce`.
2. Add a new **MySQL** database service (if using Option A). Enable Railway backups and consider availability and retention before real sales.
3. Add a GitHub service from `Ahmedaboelela1/E-Commerce`. **Choose the feature branch `feat/skillverse-vendure-backend` for staging**, not `main` (unless PR #3 has been merged and verified).
4. Name this service `vendure-api`. Set **Root Directory = `/commerce-backend`**. Leave deployment connected only to the backend subdirectory.
5. **Build Command:** `npm run build && npm run dashboard:build`
6. **Start Command:** `npm run start`. This starts the actual Vendure API server.
7. Add a second GitHub service from the **same repository/branch**, named `vendure-worker`, and set **Root Directory = `/commerce-backend`**.
8. Use the same Build Command for the worker; **Start Command:** `npm run start:worker`.
9. Only the **API** requires a public Railway domain (Settings → Networking → Generate Domain). The worker and MySQL service should stay private. Vendure Dashboard is served on the API domain at `/dashboard/` after its Vite assets are built.
10. Configure the two services' shared backend environment variables. Never put actual passwords in GitHub or in a public screenshot.

## Required variables on API and Worker

**Railway MySQL scenario** (reference variable syntax, assuming the database service is named exactly `MySQL`):

```dotenv
APP_ENV=production
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_SSL=false
SUPERADMIN_USERNAME=YOUR_PRIVATE_ADMIN_LOGIN
SUPERADMIN_PASSWORD=GENERATE_PRIVATE_RANDOM_LONG_PASSWORD
COOKIE_SECRET=GENERATE_PRIVATE_RANDOM_SECRET_32PLUS_CHARS
BACKEND_PUBLIC_URL=https://YOUR-RAILWAY-API-DOMAIN
STOREFRONT_PUBLIC_URL=https://shop.skillverse-global.com
CORS_ORIGINS=https://shop.skillverse-global.com
ASSET_URL_PREFIX=https://YOUR-RAILWAY-API-DOMAIN/assets/
```

- These are **placeholders** and references, not live secrets. Enter values in Railway Variables for both the API and Worker, using **Shared Variables** to avoid mistakes. The `MySQL` service name in reference expressions is case-sensitive.
- A Railway-provided MySQL DB name is normally **not** `u169469823_store`; do **not** hardcode the Hostinger name if using Railway MySQL.
- The API listens on Railway-injected `PORT`. Do not manually override it unless needed.
- Set `APP_ENV=production` to require actual HTTPS URLs and enforce restrictive CORS.
- Do not add a payment provider until local seller's gateway, tax, refund and delivery rules are approved.

## Initialize in a controlled one-off execution

**Do not deploy an empty database with automatic destructive setup or synchronizing schema on each service restart.**

1. Verify selected target DB is dedicated to this Vendure installation and take a backup/snapshot.
2. In the selected backend environment run `npm run db:check`; this performs read-only checks and aborts if there are tables already present.
3. The initial migration at `src/migrations/1793467748993-initial.ts` has been generated and tested on disposable MySQL 8, but actual DB engine/version must be checked. Apply **once** using a controlled deployment command, not a recurring auto-seed:
   ```bash
   npx vendure migrate --run
   ```
4. Carefully configure superadmin credentials and run the initial population once on the empty approved database:
   ```bash
   ALLOW_INITIAL_SEED=YES_EMPTY_DB_BACKED_UP npm run seed:initial
   ```
5. Start (or restart) API and Worker. Check `/dashboard/` and test SuperAdmin login in a private browser session.
6. Complete the approved Egypt agent provisioner with the real legal merchant name, then test order and stock permissions by country. The dry-run mode `node scripts/provision-egypt.mjs` is safe and does not alter the database.
7. Only after the backend is working, change **Hostinger storefront** `VENDURE_SHOP_API_URL` to `https://YOUR-RAILWAY-API-DOMAIN/shop-api` and use the real Egypt Channel token.
8. Keep the root storefront `NEXT_PUBLIC_ENABLE_CHECKOUT=false` until payments, tax, stock quantity and email verification are production-ready.

## Data persistence warning

The default `AssetServerPlugin` uses a directory on local disk. Railway application filesystems are not durable across deployments. **Do not upload production product images or customer assets until a durable Railway volume or an object-storage asset plugin has been configured**. Use approved INEX image URLs for the initial public catalog preview.

Similarly, a database service needs backups, monitoring, and suitable storage. A database and worker on the same project do not automatically make a production-ready payment system.

## Hosting costs

Railway currently advertises **Hobby $5/month** and **Pro $20/month** baseline subscription amounts with resource-based usage. The selected services, volume, bandwidth, and backups may cost extra according to usage. Exact project cost cannot be guaranteed before deployment.

## Diagnostic checkpoints

- Railway API deployment logs show the server listening on the injected PORT; no TypeORM connection errors.
- Worker logs show the job queue starting.
- Admin API responds over HTTPS to POST requests at `/admin-api`.
- Dashboard static page renders at `/dashboard/`; no 404 from missing `dist/dashboard/index.html`.
- Sign-in succeeds only with private SuperAdmin credentials.
- All items can be browsed in the **EGP Egypt channel**, with confirmed prices for three SKUs; quantities remain unverified until manually counted.
- No test payment method receives real card numbers, no real customer personal data in preview.

## Sources

- Railway monorepo root directories: https://docs.railway.com/deployments/monorepo
- Railway MySQL service: https://docs.railway.com/databases/mysql
- Railway secret variables: https://docs.railway.com/variables
- Railway static outbound IP (Pro): https://docs.railway.com/networking/static-outbound-ips
- Vendure Railway deployment guide: https://docs.vendure.io/current/framework/deployment/deploy-to-railway
- Vendure Dashboard deployment: https://docs.vendure.io/current/framework/extending-the-dashboard/deployment
- Hostinger Remote MySQL: https://www.hostinger.com/support/1583546-how-to-set-up-remote-mysql-access-in-hostinger/
