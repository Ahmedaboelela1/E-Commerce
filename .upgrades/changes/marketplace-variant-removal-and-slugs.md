---
type: patch
areas:
  - tooling
---

## Intent

Generate an editable URL slug from the product name and allow sellers and store administrators to remove individual variants in the Products tab.

## Invariants

Existing product URLs are retained until edited. Saving removes only explicitly selected variants of the owned product using Vendure soft deletion. Every product keeps at least one variant.

## Integration guidance

Deploy the backend and its Dashboard together. The optional removedVariantIds field is supported by the existing saveMarketplaceProduct mutation. Existing callers may omit it.

## Verification

Exercise generated and custom slugs, discard a new variant, and save the removal of an existing variant. Verify the remaining variant through the Shop API and verify that removing another seller’s variant is rejected.
