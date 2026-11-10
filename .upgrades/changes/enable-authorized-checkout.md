---
type: patch
areas:
  - cart
  - checkout
  - products
  - tooling
---

## Intent

Enable checkout following the owner's explicit activation request. Retire the old NEXT_PUBLIC_ENABLE_CHECKOUT launch gate, which kept the cart button disabled when an old hosting value was missing or false.

## Invariants

The cart links to checkout and valid signed-in customers can enter the flow regardless of the legacy flag. Verified-account requirements, real stock and shipping eligibility, phone/address checks, offline payment allowlist and backend payment validation remain enforced. COD and bank transfers do not settle automatically; cards remain disabled. Sample policy claims are still hidden by default, independently of checkout.

## Integration guidance

Redeploy the storefront from this change. No API deploy, dependency update, migration or production record changes are needed. NEXT_PUBLIC_ENABLE_CHECKOUT no longer controls checkout and may be removed from hosting. NEXT_PUBLIC_SHOW_STORE_POLICIES defaults to hidden unless real policy text has been reviewed. Configure actual governorate rates and payment receiving instructions in Vendure as documented separately.

## Verification

Run upgrade validation, tests, lint, types and the production build. Verify the cart checkout link and authenticated flow work with the old flag absent or false; guests still redirect to sign-in, and missing delivery/payment selections still block placement.
