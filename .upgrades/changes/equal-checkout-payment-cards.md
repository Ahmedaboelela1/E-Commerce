---
type: patch
areas:
  - checkout
---

## Intent

Give selectable checkout payment methods the same width and height.

## Invariants

Payment descriptions wrap as needed. The tallest option sets the height of the other options at the current viewport width. Existing payment selection and review behavior is preserved.

## Integration guidance

Build and deploy the storefront.

## Verification

Compare the payment options at desktop and mobile widths with descriptions of different lengths, then select a method and continue to review.
