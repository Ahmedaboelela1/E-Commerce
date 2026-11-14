import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteFixture } from './testing/suite-fixture.mjs';

test(
    'store admin and marketplace sellers use isolated capabilities with central collection',
    { skip: !process.env.VENDURE_EMAIL_TEST_PORT, timeout: 600000 },
    async (t) => {
        const f = await suiteFixture(t);
        const created = (
            await f.admin(
                'mutation($input:JSON!){createStoreAdmin(input:$input)}',
                {
                    input: {
                        name: 'Synthetic store admin',
                        email: 'store-admin@example.invalid',
                        password: 'synthetic-admin-password',
                    },
                },
            )
        ).data.createStoreAdmin;
        assert.equal(created.role, 'admin');
        const login = async (email) => {
            const r = await f.query(
                'mutation($u:String!){login(username:$u,password:"synthetic-admin-password"){__typename ... on CurrentUser{id channels{id token}}}}',
                { u: email },
                { admin: true },
            );
            assert.equal(r.data.login.__typename, 'CurrentUser');
            return {
                token: r.token,
                channel: r.data.login.channels[0].token,
                admin: true,
            };
        };
        const a = await login('store-admin@example.invalid');
        const adm = (q, v = {}) => f.query(q, v, a);
        const seller = async (code) =>
            (
                await adm(
                    'mutation($input:JSON!){createStoreSeller(input:$input)}',
                    {
                        input: {
                            name: 'Synthetic ' + code,
                            email: code + '@example.invalid',
                            password: 'synthetic-admin-password',
                            code,
                        },
                    },
                )
            ).data.createStoreSeller;
        const va = await seller('vendor-a'),
            vb = await seller('vendor-b');
        const sa = await login('vendor-a@example.invalid'),
            sb = await login('vendor-b@example.invalid');
        const save = (opts, input) =>
            f
                .query(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    { input },
                    opts,
                )
                .then((r) => r.data.saveMarketplaceProduct);
        const prod = (name) => ({
            name,
            slug: name,
            description: 'Synthetic product',
            enabled: true,
            variants: [{ sku: name, price: 10000, stockOnHand: 10 }],
            assetIds: [],
        });
        const pa = await save(sa, prod('vendor-a-robot')),
            pb = await save(sb, prod('vendor-b-robot'));
        assert.equal(pa.ownerId, va.id);
        assert.equal(pb.ownerId, vb.id);
        assert.equal(
            (await f.query('{marketplaceProducts}', {}, sa)).data
                ?.marketplaceProducts?.total,
            1,
        );
        const denied = async (q, v = {}, opts = sa) => {
            const result = await f.raw(q, v, opts);
            assert.ok(result.errors, `must reject ${q}`);
            assert.ok(
                result.errors.every(
                    (error) =>
                        error.extensions?.code !== 'GRAPHQL_VALIDATION_FAILED',
                ),
                `Authorization test used an invalid query: ${JSON.stringify(result.errors)}`,
            );
        };
        await t.test(
            'native settings, catalog, aggregate orders and role escalation are denied',
            async () => {
                for (const opts of [a, sa, sb]) {
                    await denied(
                        'mutation{updateGlobalSettings(input:{availableLanguages:[en]}){__typename}}',
                        {},
                        opts,
                    );
                    await denied('{channels{totalItems}}', {}, opts);
                    await denied('{orders{totalItems}}', {}, opts);
                    await denied('{products{totalItems}}', {}, opts);
                    await denied('{roles{totalItems}}', {}, opts);
                    await denied(
                        'mutation{createRole(input:{code:"escalation",description:"x",permissions:[SuperAdmin]}){id}}',
                        {},
                        opts,
                    );
                }
                await denied('query($id:ID!){marketplaceProduct(id:$id)}', {
                    id: pb.id,
                });
                await denied(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    {
                        input: {
                            ...prod('stolen'),
                            id: pb.id,
                            updatedAt: pb.updatedAt,
                            variants: pb.variants,
                        },
                    },
                );
                await denied(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    {
                        input: {
                            ...prod('forged-variant'),
                            id: pa.id,
                            updatedAt: pa.updatedAt,
                            variants: pb.variants,
                        },
                    },
                );
                await denied(
                    'mutation($input:JSON!){createStoreSeller(input:$input)}',
                    {
                        input: {
                            name: 'Denied',
                            email: 'denied@example.invalid',
                            password: 'synthetic-admin-password',
                            code: 'denied',
                        },
                    },
                );
                await denied(
                    'mutation($input:JSON!){createStoreAdmin(input:$input)}',
                    {
                        input: {
                            name: 'Escalation',
                            email: 'escalation@example.invalid',
                            password: 'synthetic-admin-password',
                        },
                    },
                    a,
                );
                await denied(
                    'mutation($input:JSON!){createStoreSeller(input:$input)}',
                    {
                        input: {
                            name: 'Reassign',
                            email: 'suite-admin@example.invalid',
                            password: 'synthetic-admin-password',
                            code: 'reassign',
                        },
                    },
                    a,
                );
                const all = (await adm('{marketplaceProducts}')).data
                    .marketplaceProducts;
                assert.equal(all.total, 3);
                const otherHeader = { ...sa, channel: f.channelToken };
                await denied('{marketplaceProducts}', {}, otherHeader);
            },
        );

        await t.test(
            'product images, HTML, stock updates and optimistic edits are scoped to the seller',
            async () => {
                const { default: sharp } = await import('sharp');
                const png = await sharp({
                    create: {
                        width: 40,
                        height: 40,
                        channels: 3,
                        background: '#087f5b',
                    },
                })
                    .png()
                    .toBuffer();
                const form = new FormData();
                form.set(
                    'operations',
                    JSON.stringify({
                        query: 'mutation($file:Upload!){uploadMarketplaceImage(file:$file)}',
                        variables: { file: null },
                    }),
                );
                form.set('map', JSON.stringify({ 0: ['variables.file'] }));
                form.set(
                    '0',
                    new Blob([png], { type: 'image/png' }),
                    'synthetic.png',
                );
                const upload = await fetch(f.url(true), {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + sa.token,
                        'vendure-token': sa.channel,
                        'Apollo-Require-Preflight': 'true',
                    },
                    body: form,
                }).then((r) => r.json());
                assert.equal(upload.errors, undefined, JSON.stringify(upload));
                const image = upload.data.uploadMarketplaceImage;
                assert.equal((await fetch(image.preview)).status, 200);
                await denied(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    {
                        input: {
                            ...prod('stolen-image'),
                            assetIds: [image.id],
                        },
                    },
                    sb,
                );
                const updated = await save(sa, {
                    ...pa,
                    assetIds: [image.id],
                    description:
                        '<p>Allowed</p><script>alert(1)</script><img src=x onerror=alert(1)>',
                    variants: pa.variants.map((v) => ({
                        ...v,
                        price: 10000,
                        stockOnHand: 9,
                    })),
                });
                assert.equal(updated.assets.length, 1);
                assert.equal(updated.variants[0].stockOnHand, 9);
                assert.doesNotMatch(
                    updated.description,
                    /script|onerror|<img/i,
                );
                await denied(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    { input: { ...pa, assetIds: [], variants: pa.variants } },
                );
            },
        );
        await t.test(
            'new and expanded SKU variants use native option combinations and preserve their original IDs',
            async () => {
                const input = prod('native-multi-sku');
                input.variants.push({
                    name: 'Advanced model',
                    sku: 'native-multi-advanced',
                    price: 20000,
                    stockOnHand: 4,
                });
                let multi = await save(sb, input);
                assert.equal(multi.variants.length, 2);
                const publicProduct = (
                    await f.query(
                        '{product(slug:"native-multi-sku"){optionGroups{code options{id name}} variants{sku options{id}}}}',
                    )
                ).data.product;
                assert.equal(publicProduct.optionGroups.length, 1);
                assert.equal(publicProduct.optionGroups[0].options.length, 2);
                assert.ok(
                    publicProduct.variants.every((v) => v.options.length === 1),
                );
                multi = await save(sb, {
                    ...multi,
                    assetIds: [],
                    variants: multi.variants.map((v) => ({
                        ...v,
                        name:
                            v.sku === 'native-multi-advanced'
                                ? 'Updated advanced model'
                                : v.name,
                    })),
                });
                assert.equal(multi.variants.length, 2);
                const single = await save(sb, prod('expanded-single-sku')),
                    originalId = single.variants[0].id;
                const expanded = await save(sb, {
                    ...single,
                    assetIds: [],
                    variants: [
                        ...single.variants,
                        {
                            name: 'Additional model',
                            sku: 'expanded-extra',
                            price: 25000,
                            stockOnHand: 2,
                        },
                    ],
                });
                assert.equal(expanded.variants.length, 2);
                assert.equal(expanded.variants[0].id, originalId);
            },
        );
        await t.test(
            'Arabic content selection keeps the English edit fields intact',
            async () => {
                await f.admin(
                    'mutation{updateGlobalSettings(input:{availableLanguages:[en,ar]}){__typename}}',
                );
                await f.admin(
                    'mutation($id:ID!){updateChannel(input:{id:$id,availableLanguageCodes:[en,ar]}){__typename}}',
                    { id: f.channel.id },
                );
                await f.admin(
                    'mutation($id:ID!){updateProductVariants(input:[{id:$id,translations:[{languageCode:ar,name:"إصدار عربي"}]}]){id}}',
                    { id: pa.variants[0].id },
                );
                const fresh = (
                    await f.query(
                        'query($id:ID!){marketplaceProduct(id:$id)}',
                        { id: pa.id },
                        sa,
                    )
                ).data.marketplaceProduct;
                await save(sa, {
                    ...fresh,
                    arName: 'روبوت الاختبار',
                    arDescription: 'وصف عربي',
                    assetIds: fresh.assets.map((image) => image.id),
                    variants: fresh.variants,
                });
                const result = await fetch(f.url(true) + '?languageCode=ar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + a.token,
                        'vendure-token': a.channel,
                    },
                    body: JSON.stringify({
                        query: 'query($id:ID!){marketplaceProduct(id:$id)}',
                        variables: { id: pa.id },
                    }),
                }).then((r) => r.json());
                assert.equal(result.errors, undefined, JSON.stringify(result));
                assert.equal(
                    result.data.marketplaceProduct.variants[0].name,
                    'vendor-a-robot',
                );
                assert.equal(
                    result.data.marketplaceProduct.name,
                    'vendor-a-robot',
                );
                assert.equal(
                    result.data.marketplaceProduct.translations.find(
                        (t) => t.languageCode === 'ar',
                    ).name,
                    'روبوت الاختبار',
                );
            },
        );
        await t.test(
            'tax-inclusive store editing preserves the actual gross selling price',
            async () => {
                const zone = (
                    await f.admin(
                        'mutation($input:CreateZoneInput!){createZone(input:$input){id}}',
                        {
                            input: {
                                name: 'Synthetic tax-inclusive zone',
                                memberIds: [],
                            },
                        },
                    )
                ).data.createZone;
                const category = (
                    await f.admin('{taxCategories{items{id isDefault}}}')
                ).data.taxCategories.items.find((c) => c.isDefault);
                await f.admin(
                    'mutation($input:CreateTaxRateInput!){createTaxRate(input:$input){id}}',
                    {
                        input: {
                            name: 'Synthetic twenty percent',
                            enabled: true,
                            value: 20,
                            categoryId: category.id,
                            zoneId: zone.id,
                        },
                    },
                );
                const channel = (
                    await f.admin(
                        'mutation($input:CreateChannelInput!){createChannel(input:$input){__typename ... on Channel{id token}}}',
                        {
                            input: {
                                code: 'synthetic-inclusive-store',
                                token: 'synthetic-inclusive-token',
                                pricesIncludeTax: true,
                                defaultLanguageCode: 'en',
                                defaultCurrencyCode: 'EGP',
                                defaultTaxZoneId: zone.id,
                                defaultShippingZoneId: zone.id,
                            },
                        },
                    )
                ).data.createChannel;
                const vendor = (
                    await f.admin(
                        'mutation($input:JSON!){createStoreSeller(input:$input)}',
                        {
                            input: {
                                name: 'Synthetic inclusive seller',
                                email: 'inclusive-seller@example.invalid',
                                password: 'synthetic-admin-password',
                                code: 'inclusive',
                            },
                        },
                        { channel: channel.token },
                    )
                ).data.createStoreSeller;
                assert.ok(vendor.id);
                const actor = await login('inclusive-seller@example.invalid');
                let product = await save(actor, {
                    ...prod('synthetic-inclusive-product'),
                    variants: [
                        {
                            name: 'Inclusive robot',
                            sku: 'INCLUSIVE-SKU',
                            price: 12000,
                            stockOnHand: 3,
                        },
                    ],
                });
                const net = (
                    await f.admin(
                        'query($id:ID!){product(id:$id){variants{price priceWithTax}}}',
                        { id: product.id },
                        { channel: channel.token },
                    )
                ).data.product.variants[0];
                assert.equal(net.price, 10000);
                assert.equal(product.pricesIncludeTax, true);
                assert.equal(product.variants[0].price, 12000);
                assert.equal(product.variants[0].priceWithTax, 12000);
                product = await save(actor, {
                    ...product,
                    assetIds: [],
                    variants: product.variants,
                });
                const visible = (
                    await f.query(
                        'query($id:ID!){product(id:$id){variants{priceWithTax}}}',
                        { id: product.id },
                        { channel: channel.token },
                    )
                ).data.product;
                assert.equal(visible.variants[0].priceWithTax, 12000);
            },
        );
        await t.test(
            'store administrators cannot reach another store through guessed identifiers',
            async () => {
                const zones = (await f.admin('{zones{items{id name}}}')).data
                        .zones.items,
                    zone = zones.find((z) => z.name === 'Egypt').id;
                const foreign = (
                    await f.admin(
                        'mutation($input:CreateChannelInput!){createChannel(input:$input){__typename ... on Channel{id token} ... on ErrorResult{message}}}',
                        {
                            input: {
                                code: 'foreign-store',
                                pricesIncludeTax: false,
                                token: 'synthetic-foreign-token',
                                defaultLanguageCode: 'en',
                                defaultCurrencyCode: 'EGP',
                                defaultTaxZoneId: zone,
                                defaultShippingZoneId: zone,
                            },
                        },
                    )
                ).data.createChannel;
                assert.equal(
                    foreign.__typename,
                    'Channel',
                    JSON.stringify(foreign),
                );
                const product = (
                    await f.admin(
                        'mutation{createProduct(input:{enabled:true,translations:[{languageCode:en,name:"Foreign private product",slug:"foreign-private-product",description:""}]}){id}}',
                        {},
                        { channel: foreign.token },
                    )
                ).data.createProduct;
                await denied(
                    'query($id:ID!){marketplaceProduct(id:$id)}',
                    { id: product.id },
                    a,
                );
                await denied(
                    '{marketplaceProducts}',
                    {},
                    { ...a, channel: foreign.token },
                );
                await f.admin(
                    'mutation($input:AssignProductsToChannelInput!){assignProductsToChannel(input:$input){id}}',
                    {
                        input: {
                            productIds: [pb.id],
                            channelId: foreign.id,
                            priceFactor: 1,
                        },
                    },
                );
                await denied(
                    'mutation($input:JSON!){saveMarketplaceProduct(input:$input)}',
                    { input: { ...pb, variants: pb.variants, assetIds: [] } },
                    sb,
                );
                const vendor = (
                    await adm('{marketplaceVendors}')
                ).data.marketplaceVendors.find((v) => v.id === vb.id);
                await denied(
                    'mutation($input:JSON!){setStoreSellerActive(input:$input)}',
                    {
                        input: {
                            id: vb.id,
                            active: false,
                            version: vendor.version,
                        },
                    },
                    a,
                );
                await f.admin(
                    'mutation($input:RemoveProductsFromChannelInput!){removeProductsFromChannel(input:$input){id}}',
                    { input: { productIds: [pb.id], channelId: foreign.id } },
                );
            },
        );
        await t.test(
            'store admin maintains approved offline methods without changing handler identity',
            async () => {
                const methods = (await adm('{marketplacePaymentMethods}')).data
                    .marketplacePaymentMethods;
                const cod = methods.find((m) => m.type === 'cash-on-delivery');
                await denied(
                    'mutation($input:JSON!){saveMarketplacePaymentMethod(input:$input)}',
                    { input: cod },
                    sa,
                );
                await adm(
                    'mutation($input:JSON!){saveMarketplacePaymentMethod(input:$input)}',
                    {
                        input: {
                            ...cod,
                            description: 'Synthetic payment instructions',
                        },
                    },
                );
                await denied(
                    'mutation($input:JSON!){saveMarketplacePaymentMethod(input:$input)}',
                    { input: cod },
                    a,
                );
                const current = (
                    await adm('{marketplacePaymentMethods}')
                ).data.marketplacePaymentMethods.find((m) => m.id === cod.id);
                await denied(
                    'mutation($input:JSON!){saveMarketplacePaymentMethod(input:$input)}',
                    { input: { ...current, type: 'fake-gateway' } },
                    a,
                );
            },
        );
        // Native Dashboard defaults to auto; an existing zero-tax method may
        // explicitly include tax. Equivalent policies must remain usable together.
        await f.admin(
            'mutation($input:CreateShippingMethodInput!){createShippingMethod(input:$input){id}}',
            {
                input: {
                    code: 'synthetic-giza-auto-tax',
                    fulfillmentHandler: 'manual-fulfillment',
                    checker: {
                        code: 'egypt-governorate',
                        arguments: [{ name: 'governorate', value: 'giza' }],
                    },
                    calculator: {
                        code: 'default-shipping-calculator',
                        arguments: [
                            { name: 'rate', value: '15000' },
                            { name: 'includesTax', value: 'auto' },
                            { name: 'taxRate', value: '0' },
                        ],
                    },
                    translations: [
                        {
                            languageCode: 'en',
                            name: 'Synthetic Giza delivery',
                            description: 'Synthetic method',
                        },
                    ],
                },
            },
        );
        const rates = {};
        for (const [opts, v, rate] of [
            [sa, va, 1000],
            [sb, vb, 2000],
        ])
            rates[v.id] = (
                await f.query(
                    'mutation($input:JSON!){saveMarketplaceDeliveryRate(input:$input)}',
                    {
                        input: {
                            vendorId: v.id,
                            governorate: 'cairo',
                            name: v.name + ' delivery',
                            description: 'Synthetic manual delivery',
                            rate,
                        },
                    },
                    opts,
                )
            ).data.saveMarketplaceDeliveryRate.id;
        await denied(
            'mutation($input:JSON!){saveMarketplaceDeliveryRate(input:$input)}',
            {
                input: {
                    vendorId: vb.id,
                    governorate: 'giza',
                    name: 'stolen',
                    rate: 1,
                },
            },
        );
        const buyer = await f.customer('marketplace-buyer@example.invalid');
        const opts = { token: buyer };
        const shop = (q, v = {}) => f.query(q, v, opts);
        async function add(id) {
            const r = (
                await shop(
                    'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id} ... on ErrorResult{message}}}',
                    { id },
                )
            ).data.addItemToOrder;
            assert.equal(r.__typename, 'Order', JSON.stringify(r));
            return r.id;
        }
        const orderId = await add(pa.variants[0].id);
        await add(pb.variants[0].id);
        await add(f.variant.id);
        const address = (
            await shop(
                'mutation{setOrderShippingAddress(input:{fullName:"Synthetic Buyer",streetLine1:"Synthetic test address",city:"Cairo",province:"cairo",countryCode:"EG",postalCode:"11511",phoneNumber:"01000000000"}){__typename ... on ErrorResult{message}}}',
            )
        ).data.setOrderShippingAddress;
        assert.equal(address.__typename, 'Order');
        const quoteQuery =
            '{eligibleShippingMethods{id name deliveryGroup sellerName priceWithTax}}';
        const quotes = (await shop(quoteQuery)).data.eligibleShippingMethods;
        assert.equal(
            new Set(quotes.map((q) => q.deliveryGroup)).size,
            3,
            JSON.stringify(quotes),
        );
        const ids = [f.shipping.id, rates[va.id], rates[vb.id]].map(String);
        const setDelivery = (selected) =>
            shop(
                'mutation($ids:[ID!]!){setMarketplaceDelivery(shippingMethodIds:$ids)}',
                { ids: selected },
            );
        await t.test(
            'shared cart requires every seller delivery, including direct API transitions',
            async () => {
                await denied(
                    'mutation($ids:[ID!]!){setMarketplaceDelivery(shippingMethodIds:$ids)}',
                    { ids: [ids[1]] },
                    opts,
                );
                await denied(
                    'mutation($ids:[ID!]!){setMarketplaceDelivery(shippingMethodIds:$ids)}',
                    { ids: [ids[0], ids[0], ids[1]] },
                    opts,
                );
                await shop(
                    'mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename}}',
                    { id: f.shipping.id },
                );
                const incomplete = (
                    await shop(
                        'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename ... on ErrorResult{message}}}',
                    )
                ).data.transitionOrderToState;
                assert.equal(
                    incomplete.__typename,
                    'OrderStateTransitionError',
                );
                await setDelivery(ids);
                const cart = (
                    await shop(
                        '{activeOrder{id shippingWithTax lines{id productVariant{id}} shippingLines{id priceWithTax}}}',
                    )
                ).data.activeOrder;
                assert.equal(cart.shippingWithTax, 14500);
                assert.equal(cart.shippingLines.length, 3);
                const [[assigned]] = await f.control.query(
                    'SELECT COUNT(DISTINCT shippingLineId) AS n FROM vendure_suite_ci.order_line WHERE orderId=?',
                    [orderId],
                );
                assert.equal(assigned.n, 3);
            },
        );
        await t.test(
            'native multi-shipping draft shrink is atomic and recomputed correctly',
            async () => {
                let cart = (
                    await shop('{activeOrder{lines{id productVariant{id}}}}')
                ).data.activeOrder;
                const remove = async (variant) =>
                    (
                        await shop(
                            'mutation($id:ID!){removeOrderLine(orderLineId:$id){__typename ... on ErrorResult{message}}}',
                            {
                                id: cart.lines.find(
                                    (l) =>
                                        String(l.productVariant.id) ===
                                        String(variant),
                                ).id,
                            },
                        )
                    ).data.removeOrderLine;
                await remove(f.variant.id);
                await setDelivery(ids.slice(1));
                assert.equal(
                    (
                        await shop(
                            '{activeOrder{shippingWithTax shippingLines{id}}}',
                        )
                    ).data.activeOrder.shippingWithTax,
                    3000,
                );
                await remove(pb.variants[0].id);
                await setDelivery([ids[1]]);
                const single = (
                    await shop(
                        '{activeOrder{shippingWithTax shippingLines{id}}}',
                    )
                ).data.activeOrder;
                assert.equal(single.shippingWithTax, 1000);
                assert.equal(single.shippingLines.length, 1);
                await add(pb.variants[0].id);
                await add(f.variant.id);
                await setDelivery(ids);
                const ready = (
                    await shop(
                        'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename}}',
                    )
                ).data.transitionOrderToState;
                assert.equal(ready.__typename, 'Order');
                await setDelivery(ids);
                assert.equal(
                    (await shop('{activeOrder{state}}')).data.activeOrder.state,
                    'AddingItems',
                );
            },
        );
        const transition = (
            await shop(
                'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename ... on ErrorResult{message}}}',
            )
        ).data.transitionOrderToState;
        assert.equal(
            transition.__typename,
            'Order',
            JSON.stringify(transition),
        );
        const placed = (
            await shop(
                'mutation{addPaymentToOrder(input:{method:"cash-on-delivery",metadata:{}}){__typename ... on Order{id code state} ... on ErrorResult{message}}}',
            )
        ).data.addPaymentToOrder;
        assert.equal(placed.__typename, 'Order', JSON.stringify(placed));
        let own = (
            await f.query(
                'query($id:ID!){marketplaceOrder(id:$id)}',
                { id: orderId },
                sa,
            )
        ).data.marketplaceOrder;
        let all = (
            await adm('query($id:ID!){marketplaceOrder(id:$id)}', {
                id: orderId,
            })
        ).data.marketplaceOrder;
        await t.test(
            'seller projection hides other items and central financial records',
            async () => {
                assert.equal(own.lines.length, 1);
                assert.equal(own.lines[0].sku, 'vendor-a-robot');
                assert.equal(own.amount, 11000);
                assert.equal(own.payments, undefined);
                assert.equal(all.lines.length, 3);
                assert.equal(
                    all.amount,
                    all.lines.reduce((sum, l) => sum + l.amount, 0) + 14500,
                );
                assert.equal(
                    (await f.query('{marketplaceOrders}', {}, sa)).data
                        .marketplaceOrders.total,
                    1,
                );
                for (const q of [
                    '{shopOperationsOrders}',
                    '{marketplacePaymentMethods}',
                ])
                    await denied(q);
                await denied(
                    'mutation($id:ID!){confirmStoreCashReceipt(orderId:$id,confirmed:true,reference:"stolen")}',
                    { id: orderId },
                );
            },
        );
        const dispatch = (options, lines) =>
            f.query(
                'mutation($input:JSON!){dispatchMarketplaceItems(input:$input)}',
                {
                    input: {
                        orderId,
                        lines,
                        carrier: 'Aramex',
                        trackingCode: 'SYNTHETIC-TRACKING',
                    },
                },
                options,
            );
        const ownLine = { id: own.lines[0].id, quantity: 1 };
        await denied(
            'mutation($input:JSON!){dispatchMarketplaceItems(input:$input)}',
            {
                input: {
                    orderId,
                    lines: [ownLine],
                    carrier: 'Aramex',
                    trackingCode: 'SYNTHETIC',
                },
            },
            sa,
        );
        let op = (
            await adm('query($id:ID!){shopOperationsOrder(orderId:$id)}', {
                id: orderId,
            })
        ).data.shopOperationsOrder;
        await adm(
            'mutation($id:ID!,$version:Int!){updateOrderCallback(orderId:$id,status:"confirmed",notes:"Synthetic phone confirmation",version:$version)}',
            { id: orderId, version: op.version },
        );
        await denied(
            'mutation($input:JSON!){dispatchMarketplaceItems(input:$input)}',
            {
                input: {
                    orderId,
                    lines: [
                        {
                            id: all.lines.find(
                                (l) => l.sku === 'vendor-b-robot',
                            ).id,
                            quantity: 1,
                        },
                    ],
                    carrier: 'Aramex',
                    trackingCode: 'SYNTHETIC',
                },
            },
            sa,
        );
        const shipped = (await dispatch(sa, [ownLine])).data
            .dispatchMarketplaceItems;
        await t.test(
            'seller can ship own items only, with native phone/payment gates',
            async () => {
                own = (
                    await f.query(
                        'query($id:ID!){marketplaceOrder(id:$id)}',
                        { id: orderId },
                        sa,
                    )
                ).data.marketplaceOrder;
                assert.equal(own.lines[0].remaining, 0);
                assert.equal(own.fulfillments[0].state, 'Shipped');
                const bOrder = (
                    await f.query(
                        'query($id:ID!){marketplaceOrder(id:$id)}',
                        { id: orderId },
                        sb,
                    )
                ).data.marketplaceOrder;
                assert.equal(bOrder.fulfillments.length, 0);
                await denied(
                    'mutation($id:ID!){transitionMarketplaceShipment(id:$id,state:"Delivered")}',
                    { id: shipped.id },
                    sb,
                );
                await f.query(
                    'mutation($id:ID!){transitionMarketplaceShipment(id:$id,state:"Delivered")}',
                    { id: shipped.id },
                    sa,
                );
                const collected = (
                    await adm(
                        'mutation($id:ID!){confirmStoreCashReceipt(orderId:$id,confirmed:true,reference:"SYNTHETIC-CASH")}',
                        { id: orderId },
                    )
                ).data.confirmStoreCashReceipt;
                assert.equal(collected.payments[0].state, 'Settled');
            },
        );
        await t.test(
            'only central administration can create and settle a manual refund',
            async () => {
                const detail = (
                    await adm('query($id:ID!){marketplaceOrder(id:$id)}', {
                        id: orderId,
                    })
                ).data.marketplaceOrder;
                const input = {
                    orderId,
                    paymentId: detail.payments[0].id,
                    amount: 500,
                    reason: 'Synthetic partial refund',
                };
                await denied(
                    'mutation($input:JSON!){refundStoreOrder(input:$input)}',
                    { input },
                    sa,
                );
                const refund = (
                    await adm(
                        'mutation($input:JSON!){refundStoreOrder(input:$input)}',
                        { input },
                    )
                ).data.refundStoreOrder;
                let current = (
                    await adm('query($id:ID!){marketplaceOrder(id:$id)}', {
                        id: orderId,
                    })
                ).data.marketplaceOrder;
                assert.equal(current.payments[0].refunds[0].state, 'Pending');
                await denied(
                    'mutation($input:JSON!){settleStoreRefund(input:$input)}',
                    {
                        input: {
                            orderId,
                            refundId: refund.id,
                            confirmed: false,
                            reference: 'SYNTHETIC',
                        },
                    },
                    a,
                );
                await adm(
                    'mutation($input:JSON!){settleStoreRefund(input:$input)}',
                    {
                        input: {
                            orderId,
                            refundId: refund.id,
                            confirmed: true,
                            reference: 'SYNTHETIC-REFUND-RECEIVED',
                        },
                    },
                );
                current = (
                    await adm('query($id:ID!){marketplaceOrder(id:$id)}', {
                        id: orderId,
                    })
                ).data.marketplaceOrder;
                assert.equal(current.payments[0].refunds[0].state, 'Settled');
            },
        );
        await t.test(
            'store admin cancels an unshipped order while seller cannot cancel the customer order',
            async () => {
                const token = await f.customer(
                        'cancel-marketplace@example.invalid',
                    ),
                    o = { token };
                const id = (
                    await f.query(
                        'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id}}}',
                        { id: pb.variants[0].id },
                        o,
                    )
                ).data.addItemToOrder.id;
                await f.query(
                    'mutation{setOrderShippingAddress(input:{fullName:"Cancellation buyer",streetLine1:"Synthetic test street",city:"Cairo",province:"cairo",countryCode:"EG",phoneNumber:"01012345678"}){__typename}}',
                    {},
                    o,
                );
                await f.query(
                    'mutation($ids:[ID!]!){setMarketplaceDelivery(shippingMethodIds:$ids)}',
                    { ids: [rates[vb.id]] },
                    o,
                );
                await f.query(
                    'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename}}',
                    {},
                    o,
                );
                const placed = (
                    await f.query(
                        'mutation{addPaymentToOrder(input:{method:"cash-on-delivery",metadata:{}}){__typename}}',
                        {},
                        o,
                    )
                ).data.addPaymentToOrder;
                assert.equal(placed.__typename, 'Order');
                await denied(
                    'mutation($input:JSON!){cancelStoreOrder(input:$input)}',
                    {
                        input: {
                            orderId: id,
                            reason: 'Synthetic cancellation',
                        },
                    },
                    sb,
                );
                await adm(
                    'mutation($input:JSON!){cancelStoreOrder(input:$input)}',
                    {
                        input: {
                            orderId: id,
                            reason: 'Synthetic cancellation',
                        },
                    },
                );
                assert.equal(
                    (
                        await adm('query($id:ID!){marketplaceOrder(id:$id)}', {
                            id,
                        })
                    ).data.marketplaceOrder.state,
                    'Cancelled',
                );
            },
        );
        await t.test(
            'disabling a seller blocks existing sessions and hides products without auto-republishing',
            async () => {
                const vendor = (
                    await adm('{marketplaceVendors}')
                ).data.marketplaceVendors.find((v) => v.id === va.id);
                await adm(
                    'mutation($input:JSON!){setStoreSellerActive(input:$input)}',
                    {
                        input: {
                            id: va.id,
                            active: false,
                            version: vendor.version,
                        },
                    },
                );
                await denied('{marketplaceProducts}');
                const product = (
                    await f.admin('query($id:ID!){product(id:$id){enabled}}', {
                        id: pa.id,
                    })
                ).data.product;
                assert.equal(product.enabled, false);
                await adm(
                    'mutation($input:JSON!){setStoreSellerActive(input:$input)}',
                    {
                        input: {
                            id: va.id,
                            active: true,
                            version: vendor.version + 1,
                        },
                    },
                );
                assert.equal(
                    (
                        await f.query(
                            'query($id:ID!){marketplaceProduct(id:$id)}',
                            { id: pa.id },
                            sa,
                        )
                    ).data.marketplaceProduct.enabled,
                    false,
                );
            },
        );

        if (process.env.SUITE_MARKETPLACE_BROWSER === 'true') {
            const { marketplaceBrowserSuite } = await import(
                './testing/marketplace-browser-suite.mjs'
            );
            await marketplaceBrowserSuite(t, f);
        }
    },
);
