---
type: minor
areas:
  - products
  - search
  - collections
  - site
  - tooling
---

## Intent

Add recently viewed product cards on the home/product pages, and make catalog search, collection/attribute/availability filters and ascending/descending price sorting accessible on desktop and mobile, including empty results.

## Invariants

Browsing history contains at most twelve product IDs/timestamps, is scoped to the active channel, expires after thirty days and stays in browser storage. It requires no account or analytics service and can be cleared. Display up to eight currently visible native products in recency order with current prices; exclude the open product. Disabled/deleted/foreign-channel IDs cannot expose products. Blocked/corrupt storage must not break browsing. Search uses native Vendure filtering and sorting before pagination, OR within a facet and AND across facets, preserves filters in the URL, resets pagination on changes and keeps controls available for zero results. Facet values and categories come from actual catalog configuration; none are fabricated.

## Integration guidance

Deploy the storefront only; no backend migration or new merchant configuration is required. Manage categories in Catalog Collections and real attribute filters in Facets/Product Variants. The backend already indexes stock availability. Browsing history is device/browser specific and can be cleared from its section.

## Verification

Run storefront tests, lint, types, upgrade validation and production build. Use isolated native MySQL/Chromium tests for visit order, persistence, expiry/clearing, current/disabled/foreign-product exclusion, search, category and attribute intersections, availability, both price directions, pagination reset, empty results and mobile controls.
