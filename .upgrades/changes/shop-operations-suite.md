---
type: minor
areas:
  - commerce
  - account
  - orders
  - products
  - site
  - tooling
  - platform.next
---

## Intent

Add channel-scoped telephone confirmation, private transfer-proof review, manual shipment tracking, immutable order PDF invoices, native promotion creation, low-stock email alerts, order-cohort sales reports, account wishlists and moderated verified-purchase reviews.

## Invariants

Verified account checkout, per-governorate delivery rates, existing order totals and offline payment authorizations remain authoritative. Cards stay disabled. Proof upload never settles payment; staff must explicitly verify real funds. Egypt shipments require telephone confirmation and bank transfers require settlement. COD can ship while still Authorized, without recording collection. Native fulfillment creation and transitions enforce the same guard. Private proofs never enter the public AssetServer. Owners, roles and channels bound every private operation. Only delivered buyers may submit reviews, and edits require fresh moderation. Invoices snapshot actual seller details and stored order totals, with no fabricated legal identity.

## Integration guidance

Deploy matching storefront and backend commits, including the Dashboard bundle. The committed additive migration creates six feature tables. Back up first; keep synchronize false. Configure persistent ASSET_UPLOAD_DIR and a separate private PRIVATE_RECEIPT_DIR, real merchant invoice fields and opt-in notification settings. Existing SMTP alias and job queue are reused. The owner's consolidated setup checklist and feature limits are in SHOP-OPERATIONS.md. Storefront uses the same Geist typography from local licensed font packages so production builds do not require Google Fonts network access.

## Verification

Run upgrade validation, storefront unit/architecture/i18n tests, lint, types and production build; backend type/server/Dashboard builds and existing unit/email integration tests. The real MySQL operations suite exercises coupon totals, native fulfillment gates, uncollected COD, private multipart proof and explicit bank settlement, immutable PDF snapshots, review moderation and stale versions, channel/role/owner boundaries, low-stock deduplication and sales aggregates. Optional Playwright suite runs both production builds and the actual customer/admin interfaces against isolated synthetic data.
