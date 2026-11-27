---
type: patch
areas:
  - checkout
  - tooling
---

## Intent

Show each eligible delivery option in a full-width row with readable description and price. Manage delivery rates from Shop operations.

## Invariants

Keep separate parcels for mixed-seller orders. In the Egypt channel an unconditional zero-price flat rate yields to the same carrier’s matching governorate rate. Identify the carrier by a shared translated name, optionally qualified by the governorate. Other carriers and threshold offers retain their eligibility.

## Integration guidance

Deploy the backend and storefront. The Delivery rates tab links to advanced shipping setup for SuperAdmin.

## Verification

Exercise a Cairo address with a generic free carrier method and a governorate tariff. Check mixed-seller checkout, rich-text descriptions, and payment transition.
