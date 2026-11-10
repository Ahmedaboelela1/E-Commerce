# Egypt delivery rates and manual bank transfer

The storefront supports cash on delivery and manual InstaPay/bank transfer. Cards
and wallets remain disabled. Orders require a verified customer account and a
reachable phone number. Dispatch stays manual after telephone confirmation.

## Governorate rates in Vendure Dashboard

Deploy the updated API and storefront, then select **skillverse-eg** in Dashboard.
Use **Settings → Shipping Methods**. Each governorate has its own method and rate;
there is no universal EGP 115 rate and no invented default for an unpriced region.

For each governorate you actually serve:

1. Create a shipping method, e.g. code `aramex-cairo`, name `Aramex — Cairo`.
2. Set the description to the approved service estimate, e.g. delivery in 4–5
   business days after order confirmation and dispatch. This is an estimate,
   not automatic carrier booking or an API guarantee.
3. Use **manual fulfillment** and the checker **Egypt delivery by governorate /
   الشحن حسب المحافظة** (`egypt-governorate`); choose the governorate in its selector.
4. Use the **Default Flat-Rate Shipping Calculator**. Enter that governorate's
   actual approved price in EGP in the Dashboard currency field. Choose the correct
   tax rate and tax-inclusive/exclusive setting for your merchant. The checkout
   shows `priceWithTax`; verify this is the intended final delivery charge.
5. Assign the method to **skillverse-eg** and save. Do not leave a generic legacy
   Egypt-wide method enabled if it bypasses your governorate pricing policy.

To change a price later, edit that governorate's calculator in the same Dashboard
screen. New cart calculations use the current rate; placed orders retain their
existing totals unless an administrator explicitly edits them. The integration
test verifies this with synthetic rates, not production prices.

Customers select their governorate from the 27-option dropdown in checkout and
saved-address forms. Existing Arabic/English values are recognized. The checker accepts the
27 governorates in Arabic or English, including common spelling variants, but
rejects other countries/channels/currencies and mismatched governorates. Unknown
or unconfigured governorates have no quote; they are not charged an assumed rate.

## Payment methods in Dashboard

Use **Settings → Payment Methods**, still in **skillverse-eg**:

| Option | Method code | Handler |
| --- | --- | --- |
| Cash on Delivery | `cash-on-delivery` | `cash-on-delivery` |
| InstaPay or Bank Transfer | `bank-transfer` | `bank-transfer` |

For transfer, enter the **real public receiving instructions in the method's
Description**: beneficiary name, InstaPay address, bank name and account/IBAN as
applicable. These details are intended for customers, not credentials. Keep the
method disabled until you have entered and checked them. No receiving account
has been invented or provisioned by the code change.

The checkout displays the description before ordering. At order placement the
backend snapshots its plain-text instructions into public payment metadata,
ignoring any customer-supplied replacement. Confirmation, the customer's order
page and the order email show those instructions with the order number as the
transfer reference. Later account changes do not rewrite old orders' instructions.

Creating a transfer request does **not** verify receipt or charge a card. Its
Vendure Payment state is `Authorized` (pending manual verification), not `Settled`.
Staff check actual receipt with the receiving account, record the reference and
phone-call outcome in Order History / Notes, then use **Settle Payment** only after
receipt is confirmed. A customer statement or uploaded screenshot alone is not
automatic verification. COD settlement remains after physical cash collection.

## Deployment and verification

- Deploy **both** API and storefront from the compatible updated main revision.
  No new dependencies or database migration are required.
- Configure the production payment/shipping records through Dashboard as above.
  Checkout is enabled in the updated storefront code following the owner's request;
  the old `NEXT_PUBLIC_ENABLE_CHECKOUT` gate is retired. Redeploy the shop to apply it.
- Verify two governorates produce their own approved rates, changing province
  updates eligible shipping, and the final total includes the displayed shipping.
- Test COD and transfer separately: separate customer/staff mail, pending payment,
  manual receipt verification and no automatic fulfillment. Confirm the original
  order total remains intact after a rate edit.
- Aramex shipment booking, tracking and pickup are manual; there is no Aramex API
  integration. Visa/Mastercard/e-wallet gateways are outside this change.
