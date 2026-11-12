---
type: minor
areas:
  - account
  - authentication
  - cart
  - checkout
  - collections
  - commerce
  - orders
  - products
  - search
  - platform.i18n
  - platform.next
  - site
  - tooling
---

## Intent

Replace German with Arabic alongside English, with translated interface messages, a self-hosted Arabic font and RTL navigation/forms. Fix enabled payment methods with merchant-defined codes such as `01`/`02` disappearing from checkout.

## Invariants

Native eligibility and the actual approved bank-transfer/COD handler determine available payment options. Never infer payment behavior from a display name. Cards stay disabled; verified accounts, valid delivery contact and EGP remain required. Offline payment placement is an unpaid authorization. Phone confirmation, manual bank verification, proof privacy, fulfillment gates and email wording work with arbitrary method codes. Existing financial records and stored translations are preserved.

## Integration guidance

Deploy the backend and native Dashboard first, then the storefront: the storefront queries the new `PaymentMethodQuote.offlineType`. No database migration or new secret is required. In Vendure enable Arabic in Global Settings and the Egypt channel's available languages; retain English as default. Translate actual merchant product/category content through Vendure when ready; untranslated merchant data falls back to English. Product help now offers English/Arabic. Existing `/de/...` links permanently redirect to `/ar/...` preserving query tokens; the language menu preserves filters and fragments. Payment Methods must use the actual `cash-on-delivery` or `bank-transfer` Handler, be enabled/assigned in the storefront channel, and pass native eligibility. Configure real receiving instructions in the bank method description. Its public method code may be arbitrary. Shipping stays manual and selected zero-cost delivery displays zero instead of uncalculated.

## Verification

Run translation key/ICU parity, checkout safety and architecture tests, lint, types, upgrade validation and production builds. Exercise native MySQL orders with codes `01`/`02`, unpaid status, bank proof/manual verification, telephone/fulfillment guards and emails. Run built Chromium English/Arabic checkout, language switch/filter preservation, legacy token redirects, mobile RTL and Arabic account/catalog screens. Verify Hostinger redeployment and actual customer payment visibility separately.
