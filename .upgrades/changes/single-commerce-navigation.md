---
type: patch
areas:
  - tooling
---

## Intent

Make Sales → Shop operations the normal entry point for Orders, Products and Payments. Hide duplicate native Orders, Products, Product Variants and Payment Methods sidebar items when the corresponding consolidated tabs are available.

## Invariants

This changes navigation only. API permissions, seller isolation, existing products, orders and payment records are unchanged. Native order readers retain their Shop operations Orders view. Native catalog/payment entries remain for legacy roles without the new store capabilities and for global setup on the system/default channel. Advanced native detail routes remain available to authorized staff; the product editor exposes advanced options to SuperAdmin only.

## Integration guidance

Redeploy the backend including its Dashboard build and refresh the browser. On the actual store channel, use Sales → Shop operations → Orders, Products or Payments. No migration, account recreation or customer storefront deployment is required. Complex option matrices use the Advanced product options link; native tax/shipping setup remains available to authorized administrators.

## Verification

Run backend types/server/Dashboard builds and production Chromium marketplace tests. Expand sidebar sections to check duplicate links are absent for SuperAdmin, store Admin and Seller; verify new Products, Orders and Payments tabs, advanced links and legacy staff access. Run the existing operations/browser regressions and required root tests, lint, types, upgrade validation and production build.
