---
type: patch
areas:
  - checkout
  - account
  - tooling
---

## Intent

Replace the free-text Egyptian governorate field with a required dropdown containing all 27 governorates, in checkout and saved-address forms.

## Invariants

Option values match the existing backend shipping matcher. Arabic/English saved names and supported aliases display the correct selection without rewriting saved records. Unknown Egyptian values require a new valid selection. Other countries retain their text province field. Delivery rates and checkout/payment validation remain unchanged.

## Integration guidance

Redeploy the storefront only. No API deployment, database migration or pricing changes are needed. Continue editing governorate delivery prices in Vendure Dashboard.

## Verification

Run upgrade validation, tests, lint, types and production build. Verify 27 selectable governorates, no default governorate for a new address, Arabic/English saved values selected correctly, and compatibility with the existing backend matcher.
