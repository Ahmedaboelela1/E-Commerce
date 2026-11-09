---
type: minor
areas:
  - checkout
  - authentication
  - orders
  - tooling
---

## Intent

Prepare Skillverse Egypt checkout to require verified registered accounts, collect a reachable telephone number and accept cash-on-delivery **order requests pending a staff confirmation call**; reserve Visa for a later payment-provider integration.

## Invariants

- Neither COD nor Visa is launched by committing this patch. Existing `NEXT_PUBLIC_ENABLE_CHECKOUT=false` keeps customer checkout disabled until manual readiness checks.
- The backend COD handler rejects guest sessions, wrong currency and missing shipping contact numbers; COD Payment is `Authorized`, **not** `Settled`.
- Visa is visible only as a disabled future option; no payment gateway, keys or real card payment are created.
- Admins call customers and log confirmation before dispatch, and log cash collection only upon actual receipt.
- Registration verification remains enabled and **requires a separate SMTP/email plugin setup** before accepting real customers.
- Product, channel, stock and prices remain untouched; no database migration.

## Integration guidance

See `docs/egypt-cod-launch-plan.md` for the mandatory image storage, SMTP, shipping, payment method, inventory, legal terms, telephone confirmation and staff notification steps. The changes can be deployed while checkout remains disabled. Do not enable public checkout solely based on CI results.

## Verification

Root Next.js CI (lint/types/tests/build), Vendure backend build and MySQL first-boot, and manual staging confirmation that guest checkout is rejected, Visa disabled and COD is not recorded as paid before actual cash collection.
