import assert from 'node:assert/strict';
import path from 'node:path';
import { waitFor } from './suite-fixture.mjs';

export async function marketplaceCheckoutBrowserSuite(
    t,
    f,
    browser,
    origin,
    artifacts,
) {
    const seller = (
        await f.admin(
            'mutation($input:JSON!){createStoreSeller(input:$input)}',
            {
                input: {
                    name: 'Shared cart browser seller',
                    email: 'shared-cart-seller@example.invalid',
                    password: 'synthetic-admin-password',
                    code: 'shared-cart-browser',
                },
            },
        )
    ).data.createStoreSeller;
    const product = (
        await f.admin(
            'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
            {
                input: {
                    vendorId: seller.id,
                    name: 'Shared browser robot',
                    slug: 'shared-browser-robot',
                    enabled: true,
                    variants: [
                        {
                            name: 'Shared browser robot',
                            sku: 'SHARED-BROWSER',
                            price: 10000,
                            stockOnHand: 8,
                        },
                        {
                            name: 'Advanced browser robot',
                            sku: 'SHARED-BROWSER-ADVANCED',
                            price: 15000,
                            stockOnHand: 5,
                        },
                    ],
                    assetIds: [],
                },
            },
        )
    ).data.saveMarketplaceProduct;
    const rate = (
        await f.admin(
            'mutation($input:JSON!){saveMarketplaceDeliveryRate(input:$input)}',
            {
                input: {
                    vendorId: seller.id,
                    governorate: 'cairo',
                    name: 'Seller parcel delivery',
                    description: 'Synthetic separate delivery',
                    rate: 2000,
                },
            },
        )
    ).data.saveMarketplaceDeliveryRate;
    const token = await f.customer('shared-cart-browser@example.invalid'),
        shop = (q, v = {}) => f.query(q, v, { token });
    for (const id of [f.variant.id, product.variants[0].id]) {
        const added = (
            await shop(
                'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on ErrorResult{message}}}',
                { id },
            )
        ).data.addItemToOrder;
        assert.equal(added.__typename, 'Order', JSON.stringify(added));
    }
    await shop(
        'mutation{setOrderShippingAddress(input:{fullName:"Shared buyer",streetLine1:"Synthetic test address",city:"Cairo",province:"cairo",countryCode:"EG",phoneNumber:"01012345678"}){__typename}}',
    );
    // Simulate a legacy single-method selection. The UI must return to Delivery,
    // because the newly added seller has not received a delivery selection yet.
    await shop(
        'mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename}}',
        { id: f.shipping.id },
    );
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
    });
    await context.addCookies([
        { name: 'vendure-auth-token', value: token, url: origin },
    ]);
    const page = await context.newPage();
    await t.test(
        'seller-created native SKU options can be selected and purchased',
        async () => {
            await page.goto(origin + '/en/product/shared-browser-robot');
            await page.getByText('Advanced browser robot', {exact:true}).click();
            await page.getByRole('button', { name: /^Add to Cart$/i }).click();
            await waitFor(async () => {
                const cart = (
                    await shop('{activeOrder{lines{productVariant{sku}}}}')
                ).data.activeOrder;
                return cart.lines.some(
                    (line) =>
                        line.productVariant.sku === 'SHARED-BROWSER-ADVANCED',
                );
            }, 'Selected seller SKU was not added to the customer cart');
        },
    );
    await t.test(
        'production shared checkout shows every seller fee and requires complete delivery before payment',
        async () => {
            await page.goto(origin + '/en/checkout');
            await page
                .getByText(
                    'Your items ship separately. Choose delivery for each seller; the total includes all delivery charges.',
                    { exact: true },
                )
                .waitFor();
            await page
                .getByText('Seller parcel delivery', { exact: true })
                .waitFor();
            assert.equal(await page.locator('fieldset').count(), 2);
            await page
                .getByRole('button', {
                    name: 'Continue to payment',
                    exact: true,
                })
                .click();
            await page
                .getByText('InstaPay / Bank transfer', { exact: true })
                .waitFor();
            const cart = (
                await shop(
                    '{activeOrder{shippingWithTax shippingLines{shippingMethod{id}}}}',
                )
            ).data.activeOrder;
            assert.equal(cart.shippingWithTax, 13500);
            assert.equal(cart.shippingLines.length, 2);
            assert.ok(
                cart.shippingLines.some(
                    (line) =>
                        String(line.shippingMethod.id) === String(rate.id),
                ),
            );
            await page.screenshot({
                path: path.join(artifacts, 'shared-cart-checkout.png'),
                fullPage: true,
            });
        },
    );
    await t.test(
        'shared checkout preserves delivery groups in Arabic',
        async () => {
            await page.goto(origin + '/ar/checkout');
            await page.getByRole('button', { name: /طريقة التوصيل/ }).click();
            await page
                .getByText(
                    'المنتجات هتتشحن بشكل منفصل. اختر طريقة توصيل لكل بائع؛ الإجمالي يشمل مصاريف الشحن كلها.',
                    { exact: true },
                )
                .waitFor();
            await page
                .getByText('Seller parcel delivery', { exact: true })
                .waitFor();
            assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
            await page.screenshot({
                path: path.join(artifacts, 'shared-cart-delivery-ar.png'),
                fullPage: true,
            });
        },
    );
    await context.close();
}
