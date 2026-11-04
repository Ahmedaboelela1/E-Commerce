# Connect Skillverse customer storefront to Vendure Egypt

The customer-facing `shop.skillverse-global.com` Next.js website and the `api.skillverse-global.com` Vendure application are **two applications in the same Hostinger account**, backed by the real Vendure MySQL database.

## Step 1 — Set variables on the CUSTOMER STOREFRONT website

In hPanel, select **shop.skillverse-global.com** (NOT the `api` backend application). Edit its Node.js **Environment Variables** and set:

```dotenv
VENDURE_SHOP_API_URL=https://api.skillverse-global.com/shop-api
VENDURE_CHANNEL_TOKEN=<copy the actual token from Vendure Admin → Settings → Channels → skillverse-eg>
NEXT_PUBLIC_SITE_URL=https://shop.skillverse-global.com
NEXT_PUBLIC_SITE_NAME=Skillverse Global Shop
NEXT_PUBLIC_ENABLE_CHECKOUT=false
```

- **Copy the actual Channel Token**, not just `skillverse-eg` (the Code field). The two can differ. It is a channel selector, **not** the Super Admin password.
- Do not put the MySQL password, `COOKIE_SECRET`, admin credentials or Admin API address in the Next.js storefront variables.
- Make sure any old `VENDURE_SHOP_API_URL` pointing at `readonlydemo.vendure.io` is **replaced**, not duplicated.
- Use the **server-only variable names**, not `NEXT_PUBLIC_VENDURE_SHOP_API_URL` and `NEXT_PUBLIC_VENDURE_CHANNEL_TOKEN` unless there is a specific reason.
- Save and **redeploy/rebuild the storefront** because its `next.config.ts`, frontend and public environment settings change at build time. **Do not redeploy the backend** just to update these customer-facing settings.

## Step 2 — Verify the Vendure product and channel

Inside the Vendure Dashboard, use **skillverse-eg** in the channel selector and confirm:

- `POP-BOT32i Soccer Robot Kit` is enabled and assigned to this channel.
- Variant SKU is `INEX-8300158`; its Egypt-specific price is **25,000 EGP**.
- The actual `Stock Location` is assigned to `skillverse-eg`.
- A zero quantity is allowed for preview and should read **out of stock** (do not fabricate inventory).
- The product asset is available under the real backend HTTPS domain. This PR adds that hostname to Next.js `images.remotePatterns`.
- Search indexing jobs are processing; if a product does not appear, inspect Vendure System → Job Queue or reindex the search index as appropriate.

## Step 3 — Verify as a customer

- Open `https://shop.skillverse-global.com/en/search` in a private browser window.
- Find `POP-BOT32i Soccer Robot Kit`, inspect its image, price and product detail page at `/en/product/pop-bot32i-soccer-robot-kit`.
- EGP prices are drawn from the Egypt Channel; a leftover USD currency cookie from the demo is ignored.
- The homepage now fetches the channel's actual products rather than hardcoding a demo `electronics` collection.
- For the pilot, **checkout remains disabled**. No real payment/shipping integration is present and stock quantity is still zero.

If the storefront shows demo products, confirm which Hostinger website received the updated variables and that the new Next.js deployment completed successfully.

If the frontend displays `Error: HTTP 4xx` or a blank list, check its runtime logs and verify both Shop API URL and Channel Token exactly.

If the shop gets a Next.js image error, check the image preview URL is served under `https://api.skillverse-global.com/assets/` and images are still available after a backend redeployment; current local Vendure asset files are **not guaranteed persistent** on Hostinger web hosting.

## Before enabling checkout

A later workstream must confirm: legally responsible seller, verified inventory, shipping methods/rates, Egypt tax setup, real payments or cash-on-delivery method, email verification and notifications, public terms and returns, plus reliable background job processing. Only then set `NEXT_PUBLIC_ENABLE_CHECKOUT=true` and redeploy the storefront.

The official Vendure Shop API uses HTTP POST GraphQL requests and the `vendure-token` header. Visiting the API URL directly in a browser with GET is not a valid product API test.

Documentation:
- https://docs.vendure.io/current/framework/storefront/connect-api
- https://docs.vendure.io/current/framework/core-concepts/channels
- https://nextjs.org/docs/app/api-reference/components/image
