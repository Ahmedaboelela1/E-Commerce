---
type: patch
areas:
  - tooling
---

## Intent

Fix the native Vendure Shipping Method editor crashing with `label.find is not a function` when a governorate selector or its saved summary renders. Its options need localized label arrays, rather than plain strings.

## Invariants

Preserve all 27 existing governorate codes, bilingual display names, native shipping method IDs and saved calculator rates. Address eligibility, channel/currency checks, existing orders and manual fulfillment stay unchanged. No shipping-company API or new tariff is introduced.

## Integration guidance

Redeploy the Vendure backend from the updated source, then refresh the Dashboard. No database migration, customer storefront change or new secret is needed. The existing native Dashboard select works with the corrected API configuration; existing methods do not need recreation. Normal backend builds also rebuild its native Dashboard bundle.

## Verification

Run backend types/build and the offline payment/shipping tests, including a regression covering native label lookup for all 27 governorates in English and Arabic. Run `test-governorate-dashboard-mysql.mjs` with an isolated MySQL fixture and Chromium to select a governorate on a new method, save a price, reload and edit the method, verify native quotes for matching/nonmatching provinces, and ensure an existing method's saved province/rate are preserved. Run root tests, lint, types, upgrade validation and production build as required by the repository.
