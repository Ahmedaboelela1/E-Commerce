---
type: patch
areas:
  - products
  - cart
  - checkout
  - tooling
---

## Intent

Restore Add to Cart and the navbar cart when checkout is closed. Customers can prepare a draft cart before order submission opens.

## Invariants

Out-of-stock and unselected variants cannot be added through the product controls. Vendure still validates stock. NEXT_PUBLIC_ENABLE_CHECKOUT continues to guard checkout and payment server-side, registered verified accounts remain required, and Visa stays disabled. Cart additions do not submit a COD request or send order emails.

## Integration guidance

Redeploy the storefront. Leave NEXT_PUBLIC_ENABLE_CHECKOUT=false until shipping, stock and the complete COD flow are verified. The cart now shows a disabled checkout button and explanatory message instead of linking to a closed checkout. No backend, inventory, payment or shipping configuration changes are needed.

## Verification

Run upgrade validation, tests, lint, types and the production build. Check that in-stock products show Add to Cart with checkout closed, unavailable variants stay disabled, and checkout remains closed in both the cart UI and existing server guards.
