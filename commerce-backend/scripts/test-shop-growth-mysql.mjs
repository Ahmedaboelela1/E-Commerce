import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {suiteFixture, waitFor} from './testing/suite-fixture.mjs';

test(
    'real MySQL growth features preserve stock, ownership, consent and actual refund records',
    {skip: !process.env.VENDURE_EMAIL_TEST_PORT, timeout: 600000},
    async (t) => {
        const f = await suiteFixture(t);
        const token = await f.customer('growth-buyer@example.invalid');
        const other = await f.customer('growth-other@example.invalid');
        const shop = (q, v = {}, who = token) => f.query(q, v, {token: who});
        const deny = async (q, v = {}, options = {token: other}) =>
            assert.ok(
                (await f.raw(q, v, options)).errors,
                'request must be denied',
            );
        const product2 = (
            await f.admin(
                'mutation($input:CreateProductInput!){createProduct(input:$input){id}}',
                {
                    input: {
                        enabled: true,
                        translations: [
                            {
                                languageCode: 'en',
                                name: 'Suite Accessory Product',
                                slug: 'suite-accessory',
                                description: 'Synthetic accessory fixture',
                            },
                        ],
                    },
                },
            )
        ).data.createProduct;
        const variant2 = (
            await f.admin(
                'mutation($input:[CreateProductVariantInput!]!){createProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            productId: product2.id,
                            sku: 'SUITE-ACCESSORY',
                            price: 5000,
                            trackInventory: 'TRUE',
                            stockLevels: [
                                {
                                    stockLocationId: f.location.id,
                                    stockOnHand: 20,
                                },
                            ],
                            translations: [
                                {languageCode: 'en', name: 'Suite Accessory'},
                            ],
                        },
                    ],
                },
            )
        ).data.createProductVariants[0];
        const settings = async () =>
            (await f.admin('{shopGrowthSettings}')).data.shopGrowthSettings;
        const updateStock = async (id, n) =>
            f.admin(
                'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            id,
                            stockLevels: [
                                {
                                    stockLocationId: f.location.id,
                                    stockOnHand: n,
                                },
                            ],
                        },
                    ],
                },
            );
        let bundle, order, returnId, quote;
        await t.test(
            'localized specifications and safe help resources expose real values only',
            async () => {
                const content = {
                    specs: {
                        ageRange: 'Test ages 12+',
                        programming: 'Test Python',
                        boxContents: 'Test robot and cable',
                        competitions: 'Test competition',
                    },
                    resources: [
                        {
                            kind: 'manual',
                            title: 'Test manual',
                            url: 'https://example.invalid/manual.pdf',
                        },
                    ],
                    faqs: [
                        {question: 'Test question?', answer: 'Test answer.'},
                    ],
                };
                await f.admin(
                    'mutation($id:ID!,$input:JSON!){saveShopProductContent(productId:$id,languageCode:"en",input:$input,version:0)}',
                    {id: f.product.id, input: content},
                );
                const compared = (
                    await shop(
                        'query($ids:[ID!]!){compareShopProducts(productIds:$ids)}',
                        {ids: [f.product.id, product2.id]},
                    )
                ).data.compareShopProducts;
                assert.equal(
                    compared[0].content.specs.programming,
                    'Test Python',
                );
                assert.equal(compared[0].minimum, 10000);
                assert.equal(compared[1].minimum, 5000);
                await deny(
                    'mutation($id:ID!,$input:JSON!){saveShopProductContent(productId:$id,languageCode:"en",input:$input,version:1)}',
                    {
                        id: f.product.id,
                        input: {
                            ...content,
                            resources: [
                                {
                                    kind: 'video',
                                    title: 'Unsafe',
                                    url: 'javascript:alert(1)',
                                },
                            ],
                        },
                    },
                    {admin: true, token: f.adminToken},
                );
            },
        );
        await t.test(
            'native component lines receive exact bundle savings without double use and private metadata cannot be forged',
            async () => {
                bundle = (
                    await f.admin(
                        'mutation($input:JSON!){saveShopBundle(input:$input)}',
                        {
                            input: {
                                name: 'Suite Robot + accessory',
                                description: 'Synthetic test bundle',
                                price: 12000,
                                enabled: true,
                                sortOrder: 0,
                                version: 0,
                                components: [
                                    {variantId: f.variant.id, quantity: 1},
                                    {variantId: variant2.id, quantity: 1},
                                ],
                            },
                        },
                    )
                ).data.saveShopBundle;
                assert.equal(bundle.available, true);
                assert.equal(bundle.saving, 3000);
                await shop(
                    'mutation($id:ID!){addShopBundle(bundleId:$id,quantity:1)}',
                    {id: bundle.id},
                );
                let cart = (
                    await shop(
                        '{activeOrder{id totalWithTax lines{id quantity productVariant{id}} discounts{amountWithTax}}}',
                    )
                ).data.activeOrder;
                assert.equal(cart.lines.length, 2);
                assert.equal(cart.totalWithTax, 12000);
                order = cart;
                await deny(
                    'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1,customFields:{skillverseBundleKey:"forged"}){__typename}}',
                    {id: f.variant.id},
                    {token},
                );
                const rate = (
                    await f.admin('{taxRates{items{id name}}}')
                ).data.taxRates.items.find(
                    (r) => r.name === 'Suite test zero tax',
                );
                const rebuild = async (value) => {
                    await f.admin(
                        'mutation($input:UpdateTaxRateInput!){updateTaxRate(input:$input){id}}',
                        {input: {id: rate.id, value}},
                    );
                    const current = (await shop('{activeOrder{lines{id}}}'))
                        .data.activeOrder;
                    for (const line of current.lines)
                        await shop(
                            'mutation($id:ID!){removeOrderLine(orderLineId:$id){__typename}}',
                            {id: line.id},
                        );
                    await shop(
                        'mutation($id:ID!){addShopBundle(bundleId:$id,quantity:1)}',
                        {id: bundle.id},
                    );
                    return (
                        await shop(
                            '{activeOrder{id totalWithTax lines{id quantity productVariant{id}}}}',
                        )
                    ).data.activeOrder;
                };
                cart = await rebuild(14);
                assert.equal(
                    cart.totalWithTax,
                    13680,
                    'native VAT applies to the configured bundle net price',
                );
                cart = await rebuild(0);
                const accessory = cart.lines.find(
                    (l) => l.productVariant.id === variant2.id,
                );
                await shop(
                    'mutation($id:ID!){removeOrderLine(orderLineId:$id){__typename}}',
                    {id: accessory.id},
                );
                cart = (await shop('{activeOrder{id totalWithTax lines{id}}}'))
                    .data.activeOrder;
                assert.equal(
                    cart.totalWithTax,
                    10000,
                    'incomplete bundle loses its discount',
                );
                await shop(
                    'mutation($id:ID!){removeOrderLine(orderLineId:$id){__typename}}',
                    {id: cart.lines[0].id},
                );
                await shop(
                    'mutation($id:ID!){addShopBundle(bundleId:$id,quantity:1)}',
                    {id: bundle.id},
                );
                await shop(
                    'mutation($id:ID!){addShopBundle(bundleId:$id,quantity:1)}',
                    {id: bundle.id},
                );
                cart = (
                    await shop(
                        '{activeOrder{id totalWithTax lines{id productVariant{id} quantity}}}',
                    )
                ).data.activeOrder;
                assert.equal(cart.totalWithTax, 24000);
                assert.equal(
                    cart.lines.length,
                    4,
                    'two bundles preserve distinct private component groups',
                );
                order = cart;
            },
        );
        await t.test(
            'native checkout and manual dispatch decrement each physical component',
            async () => {
                await shop(
                    'mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename}}',
                    {
                        input: {
                            fullName: 'Growth Buyer',
                            streetLine1: 'Synthetic street',
                            city: 'Cairo',
                            province: 'القاهرة',
                            countryCode: 'EG',
                            phoneNumber: '01012345678',
                        },
                    },
                );
                await shop(
                    'mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename}}',
                    {id: f.shipping.id},
                );
                await shop(
                    'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename}}',
                );
                const placed = (
                    await shop(
                        'mutation{addPaymentToOrder(input:{method:"cash-on-delivery",metadata:{}}){__typename ... on Order{id code totalWithTax payments{id state}} ... on ErrorResult{message}}}',
                    )
                ).data.addPaymentToOrder;
                assert.equal(
                    placed.__typename,
                    'Order',
                    JSON.stringify(placed),
                );
                assert.equal(placed.totalWithTax, 35500);
                order = {...order, ...placed};
                await f.admin(
                    'mutation($id:ID!){updateOrderCallback(orderId:$id,status:"confirmed",notes:"Synthetic confirmed",version:0)}',
                    {id: order.id},
                );
                await f.admin(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"aramex",trackingCode:"GROWTH123")}',
                    {id: order.id},
                );
                const stock = (await f.admin('{shopOperationsInventory}')).data
                    .shopOperationsInventory.items;
                assert.equal(
                    stock.find((s) => String(s.id) === String(f.variant.id))
                        .onHand,
                    18,
                );
                assert.equal(
                    stock.find((s) => String(s.id) === String(variant2.id))
                        .onHand,
                    18,
                );
                const native = (
                    await f.admin(
                        'query($id:ID!){order(id:$id){fulfillments{id}}}',
                        {id: order.id},
                    )
                ).data.order;
                await f.admin(
                    'mutation($id:ID!){transitionFulfillmentToState(id:$id,state:"Delivered"){__typename}}',
                    {id: native.fulfillments[0].id},
                );
                await f.admin(
                    'mutation($id:ID!){settlePayment(id:$id){__typename}}',
                    {id: placed.payments[0].id},
                );
            },
        );
        await t.test(
            'stock watchers require consent, verify real restock and support token unsubscribe',
            async () => {
                await updateStock(variant2.id, 0);
                await shop(
                    'mutation($id:ID!){setShopStockWatch(variantId:$id,active:true)}',
                    {id: variant2.id},
                );
                const before = f.smtp.messages.filter((m) =>
                    /is available again/.test(m.raw),
                ).length;
                await f.admin('mutation{runShopCustomerNotifications}');
                assert.equal(
                    f.smtp.messages.filter((m) =>
                        /is available again/.test(m.raw),
                    ).length,
                    before,
                );
                await updateStock(variant2.id, 10);
                await f.admin('mutation{runShopCustomerNotifications}');
                await waitFor(
                    () =>
                        f.smtp.messages.some((m) =>
                            /is available again/.test(m.raw),
                        ),
                    'Restock notification missing',
                );
                assert.equal(
                    (await shop('{myStockWatches}')).data.myStockWatches.length,
                    0,
                );
                await f.admin('mutation{runShopCustomerNotifications}');
                assert.equal(
                    f.smtp.messages.filter((m) =>
                        /is available again/.test(m.raw),
                    ).length,
                    before + 1,
                );
            },
        );
        await t.test(
            'school quotes preserve ownership, staff prices, expiry and explicit customer acceptance',
            async () => {
                quote = (
                    await shop(
                        'mutation($input:JSON!){requestSchoolQuote(input:$input)}',
                        {
                            input: {
                                organization: 'Suite Test Academy',
                                phone: '01012345678',
                                notes: 'Synthetic quantity quote',
                                items: [{variantId: f.variant.id, quantity: 5}],
                            },
                        },
                    )
                ).data.requestSchoolQuote;
                assert.equal(
                    (await shop('{mySchoolQuotes}', {}, other)).data
                        .mySchoolQuotes.total,
                    0,
                );
                await f.admin(
                    'mutation($input:JSON!){saveShopOperationsSettings(input:$input)}',
                    {
                        input: {
                            sellerName: 'Synthetic seller',
                            sellerAddress: 'Synthetic address',
                            sellerTaxId: '',
                            invoicePrefix: 'TEST',
                            lowStockEnabled: false,
                            lowStockThreshold: 5,
                            notificationEmail: '',
                        },
                    },
                );
                const offer = {
                    items: [
                        {variantId: f.variant.id, quantity: 5, unitPrice: 8500},
                    ],
                    shipping: 11500,
                    message: 'Synthetic staff-reviewed offer',
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                };
                const published = (
                    await f.admin(
                        'mutation($id:ID!,$input:JSON!){publishSchoolQuote(quoteId:$id,input:$input,version:1,publish:true)}',
                        {id: quote.id, input: offer},
                    )
                ).data.publishSchoolQuote;
                assert.equal(published.status, 'quoted');
                assert.equal(published.offer.items[0].unitPrice, 8500);
                await deny(
                    'mutation($id:ID!){respondToSchoolQuote(quoteId:$id,accept:true,version:2)}',
                    {id: quote.id},
                );
                const accepted = (
                    await shop(
                        'mutation($id:ID!){respondToSchoolQuote(quoteId:$id,accept:true,version:2)}',
                        {id: quote.id},
                    )
                ).data.respondToSchoolQuote;
                assert.equal(accepted.status, 'accepted');
                await deny(
                    'mutation($id:ID!,$input:JSON!){publishSchoolQuote(quoteId:$id,input:$input,version:3,publish:true)}',
                    {id: quote.id, input: offer},
                    {admin: true, token: f.adminToken},
                );
            },
        );
        await t.test(
            'accepted quotation links only an actual matching placed order with staff-priced products and delivery',
            async () => {
                await deny(
                    'mutation($id:ID!,$order:ID!){linkSchoolQuoteOrder(quoteId:$id,orderId:$order,version:3)}',
                    {id: quote.id, order: order.id},
                    {admin: true, token: f.adminToken},
                );
                const promotion = (
                    await f.admin(
                        'mutation($input:CreatePromotionInput!){createPromotion(input:$input){__typename ... on Promotion{id} ... on ErrorResult{message}}}',
                        {
                            input: {
                                enabled: true,
                                couponCode: 'GROWTH-QUOTE-15',
                                perCustomerUsageLimit: 1,
                                translations: [
                                    {
                                        languageCode: 'en',
                                        name: 'Synthetic agreed quotation price',
                                        description:
                                            'Test-only native manual pricing',
                                    },
                                ],
                                conditions: [
                                    {
                                        code: 'minimum_order_amount',
                                        arguments: [
                                            {name: 'amount', value: '1'},
                                            {
                                                name: 'taxInclusive',
                                                value: 'false',
                                            },
                                        ],
                                    },
                                ],
                                actions: [
                                    {
                                        code: 'order_percentage_discount',
                                        arguments: [
                                            {name: 'discount', value: '15'},
                                        ],
                                    },
                                ],
                            },
                        },
                    )
                ).data.createPromotion;
                assert.equal(
                    promotion.__typename,
                    'Promotion',
                    JSON.stringify(promotion),
                );
                await shop(
                    'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:5){__typename}}',
                    {id: f.variant.id},
                );
                const coupon = (
                    await shop(
                        'mutation{applyCouponCode(couponCode:"GROWTH-QUOTE-15"){__typename ... on ErrorResult{message}}}',
                    )
                ).data.applyCouponCode;
                assert.equal(
                    coupon.__typename,
                    'Order',
                    JSON.stringify(coupon),
                );
                await shop(
                    'mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename}}',
                    {
                        input: {
                            fullName: 'Growth Buyer',
                            streetLine1: 'Synthetic quote street',
                            city: 'Cairo',
                            province: 'القاهرة',
                            countryCode: 'EG',
                            phoneNumber: '01012345678',
                        },
                    },
                );
                await shop(
                    'mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename}}',
                    {id: f.shipping.id},
                );
                await shop(
                    'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename}}',
                );
                const actual = (
                    await shop(
                        'mutation{addPaymentToOrder(input:{method:"cash-on-delivery",metadata:{}}){__typename ... on Order{id totalWithTax} ... on ErrorResult{message}}}',
                    )
                ).data.addPaymentToOrder;
                assert.equal(
                    actual.__typename,
                    'Order',
                    JSON.stringify(actual),
                );
                assert.equal(actual.totalWithTax, 54000);
                const linked = (
                    await f.admin(
                        'mutation($id:ID!,$order:ID!){linkSchoolQuoteOrder(quoteId:$id,orderId:$order,version:3)}',
                        {id: quote.id, order: actual.id},
                    )
                ).data.linkSchoolQuoteOrder;
                assert.equal(linked.status, 'completed');
                assert.equal(String(linked.orderId), String(actual.id));
            },
        );
        await t.test(
            'returns require a real delivery and policy, keep photos private, and cannot invent refunds',
            async () => {
                const input = {
                    kind: 'refund',
                    reason: 'Synthetic return test',
                    items: [{orderLineId: order.lines[0].id, quantity: 1}],
                };
                await deny(
                    'mutation($id:ID!,$input:JSON!){requestShopReturn(orderId:$id,input:$input)}',
                    {id: order.id, input},
                    {token},
                );
                let s = await settings();
                await f.admin(
                    'mutation($input:JSON!){saveShopGrowthSettings(input:$input)}',
                    {input: {...s, returnsEnabled: true, returnWindowDays: 14}},
                );
                const returned = (
                    await shop(
                        'mutation($id:ID!,$input:JSON!){requestShopReturn(orderId:$id,input:$input)}',
                        {id: order.id, input},
                    )
                ).data.requestShopReturn;
                returnId = returned.id;
                await deny(
                    'mutation($id:ID!,$input:JSON!){requestShopReturn(orderId:$id,input:$input)}',
                    {id: order.id, input},
                    {token},
                );
                assert.equal(
                    (await shop('{myReturnRequests}', {}, other)).data
                        .myReturnRequests.total,
                    0,
                );
                const image = await sharp({
                    create: {
                        width: 100,
                        height: 60,
                        channels: 3,
                        background: '#ecf5ff',
                    },
                })
                    .png()
                    .toBuffer();
                const form = new FormData();
                form.set(
                    'operations',
                    JSON.stringify({
                        query: 'mutation($id:ID!,$file:Upload!){uploadShopReturnPhoto(returnId:$id,file:$file)}',
                        variables: {id: returnId, file: null},
                    }),
                );
                form.set('map', JSON.stringify({0: ['variables.file']}));
                form.set(
                    '0',
                    new Blob([image], {type: 'image/png'}),
                    'return.png',
                );
                const r = await fetch(f.url(false), {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token,
                        'vendure-token': f.channelToken,
                        'Apollo-Require-Preflight': 'true',
                    },
                    body: form,
                });
                const data = await r.json();
                assert.equal(data.errors, undefined, JSON.stringify(data));
                assert.equal(data.data.uploadShopReturnPhoto.photoCount, 1);
                await deny(
                    'query($id:ID!){myReturnPhoto(returnId:$id,index:0)}',
                    {id: returnId},
                );
                const saved = (
                    await f.admin(
                        'query($id:ID!){shopReturnPhoto(returnId:$id,index:0)}',
                        {id: returnId},
                    )
                ).data.shopReturnPhoto;
                assert.deepEqual(
                    Buffer.from(saved.dataBase64, 'base64'),
                    image,
                );
                const update = async (status, version, extra = {}) =>
                    (
                        await f.admin(
                            'mutation($id:ID!,$input:JSON!,$version:Int!){updateShopReturn(returnId:$id,input:$input,version:$version)}',
                            {
                                id: returnId,
                                input: {
                                    status,
                                    publicMessage: 'Test customer update',
                                    internalNotes: 'Private test notes',
                                    ...extra,
                                },
                                version,
                            },
                        )
                    ).data.updateShopReturn;
                await update('authorized', 2);
                await update('received', 3);
                await deny(
                    'mutation($id:ID!){updateShopReturn(returnId:$id,input:{status:"resolved",resolution:"refund",refundId:99999},version:4)}',
                    {id: returnId},
                    {admin: true, token: f.adminToken},
                );
                const refund = (
                    await f.admin(
                        'mutation($input:RefundOrderInput!){refundOrder(input:$input){__typename ... on Refund{id state} ... on ErrorResult{message}}}',
                        {
                            input: {
                                paymentId: order.payments[0].id,
                                amount: returned.items[0].amount,
                                reason: 'Synthetic actual return refund',
                            },
                        },
                    )
                ).data.refundOrder;
                assert.equal(
                    refund.__typename,
                    'Refund',
                    JSON.stringify(refund),
                );
                if (refund.state === 'Pending')
                    await f.admin(
                        'mutation($input:SettleRefundInput!){settleRefund(input:$input){__typename}}',
                        {
                            input: {
                                id: refund.id,
                                transactionId: 'GROWTH-REFUND',
                            },
                        },
                    );
                const resolved = await update('resolved', 4, {
                    resolution: 'refund',
                    refundId: refund.id,
                });
                assert.equal(resolved.status, 'resolved');
                const own = (await shop('{myReturnRequests}')).data
                    .myReturnRequests.items[0];
                assert.equal(own.internalNotes, undefined);
                assert.equal(own.publicMessage, 'Test customer update');
            },
        );
        await t.test(
            'abandoned cart email is off without consent, sends once, and unsubscribes without login',
            async () => {
                await shop(
                    'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename}}',
                    {id: f.variant.id},
                    other,
                );
                const cart = (await shop('{activeOrder{id}}', {}, other)).data
                    .activeOrder;
                const s = await settings();
                await f.admin(
                    'mutation($input:JSON!){saveShopGrowthSettings(input:$input)}',
                    {
                        input: {
                            ...s,
                            cartRemindersEnabled: true,
                            reminderHours: 1,
                        },
                    },
                );
                await f.control.query(
                    'UPDATE vendure_suite_ci.`order` SET updatedAt=DATE_SUB(NOW(),INTERVAL 2 HOUR) WHERE id=?',
                    [cart.id],
                );
                const reminders = () =>
                    f.smtp.messages.filter((m) =>
                        /saved cart is waiting/.test(m.raw),
                    );
                await f.admin('mutation{runShopCustomerNotifications}');
                assert.equal(reminders().length, 0);
                await shop(
                    'mutation{setShopCartReminderConsent(consent:true)}',
                    {},
                    other,
                );
                await f.admin('mutation{runShopCustomerNotifications}');
                await waitFor(
                    () => reminders().length === 1,
                    'Consented cart reminder missing',
                );
                await f.admin('mutation{runShopCustomerNotifications}');
                assert.equal(reminders().length, 1);
                const raw = reminders()[0]
                    .raw.replace(/=\r\n/g, '')
                    .replace(/=3D/g, '=');
                const recovery = raw.match(/recover\?token=([a-f0-9]{64})/);
                assert.ok(recovery);
                assert.equal(
                    (
                        await shop(
                            'query($token:String!){myRecoveryCart(token:$token)}',
                            {token: recovery[1]},
                        )
                    ).data.myRecoveryCart.available,
                    false,
                );
                assert.equal(
                    (
                        await shop(
                            'query($token:String!){myRecoveryCart(token:$token)}',
                            {token: recovery[1]},
                            other,
                        )
                    ).data.myRecoveryCart.available,
                    true,
                );
                const optout = raw.match(
                    /unsubscribe\?kind=cart(?:&amp;|&)id=(\d+)(?:&amp;|&)token=([a-f0-9]{64})/,
                );
                assert.ok(optout);
                await f.query(
                    'mutation($id:ID!,$token:String!){unsubscribeShopMail(kind:"cart",id:$id,token:$token)}',
                    {id: optout[1], token: optout[2]},
                );
                assert.equal(
                    (await shop('{myShopMailPreference}', {}, other)).data
                        .myShopMailPreference.cartReminderConsent,
                    false,
                );
            },
        );
        await t.test(
            'private growth operations enforce channel boundaries and independent staff permissions',
            async () => {
                const active = (
                    await f.admin(
                        '{activeChannel{seller{id} defaultTaxZone{id} defaultShippingZone{id}}}',
                    )
                ).data.activeChannel;
                const channel = (
                    await f.admin(
                        'mutation($input:CreateChannelInput!){createChannel(input:$input){__typename ... on Channel{id token}}}',
                        {
                            input: {
                                code: 'growth-unrelated',
                                token: 'growth-unrelated-token',
                                defaultLanguageCode: 'en',
                                availableLanguageCodes: ['en'],
                                defaultCurrencyCode: 'EGP',
                                availableCurrencyCodes: ['EGP'],
                                pricesIncludeTax: false,
                                sellerId: active.seller.id,
                                defaultTaxZoneId: active.defaultTaxZone.id,
                                defaultShippingZoneId:
                                    active.defaultShippingZone.id,
                            },
                        },
                    )
                ).data.createChannel;
                assert.equal(channel.__typename, 'Channel');
                const wrong = {
                    admin: true,
                    token: f.adminToken,
                    channel: channel.token,
                };
                for (const field of [
                    'shopAdminBundles',
                    'shopSchoolQuotes',
                    'shopReturnRequests',
                ])
                    assert.deepEqual(
                        (await f.query('{' + field + '}', {}, wrong)).data[
                            field
                        ].items,
                        [],
                    );
                await deny(
                    'query($id:ID!){shopCatalogContent(productId:$id)}',
                    {id: f.product.id},
                    wrong,
                );
                await deny(
                    'query($id:ID!){shopReturnPhoto(returnId:$id,index:0)}',
                    {id: returnId},
                    wrong,
                );
                await deny(
                    'mutation($id:ID!){publishSchoolQuote(quoteId:$id,input:{},version:3,publish:true)}',
                    {id: quote.id},
                    wrong,
                );
                await deny(
                    'query($id:ID!){shopVariantAvailability(variantId:$id)}',
                    {id: f.variant.id},
                    {channel: channel.token},
                );
                await deny('{mySchoolQuotes}', {}, {token: undefined});
                await deny('{myReturnRequests}', {}, {token: undefined});
                await deny(
                    'mutation{unsubscribeShopMail(kind:"cart",id:1,token:"' +
                        '0'.repeat(64) +
                        '" )}',
                    {},
                    {token: undefined},
                );
                const role = (
                    await f.admin(
                        'mutation($input:CreateRoleInput!){createRole(input:$input){id}}',
                        {
                            input: {
                                code: 'growth-catalog-editor',
                                description:
                                    'Synthetic independent permission test',
                                permissions: [
                                    'ReadCatalog',
                                    'UpdateCatalog',
                                    'ReadOrder',
                                    'ReadSettings',
                                ],
                                channelIds: [f.channel.id],
                            },
                        },
                    )
                ).data.createRole;
                await f.admin(
                    'mutation($input:CreateAdministratorInput!){createAdministrator(input:$input){id}}',
                    {
                        input: {
                            emailAddress: 'growth-editor@example.invalid',
                            firstName: 'Growth',
                            lastName: 'Editor',
                            password: 'growth-synthetic-editor-password',
                            roleIds: [role.id],
                        },
                    },
                );
                const login = await f.query(
                    'mutation{login(username:"growth-editor@example.invalid",password:"growth-synthetic-editor-password"){__typename ... on CurrentUser{id}}}',
                    {},
                    {admin: true},
                );
                assert.ok(login.token);
                const editor = {admin: true, token: login.token};
                assert.equal(
                    (await f.query('{shopAdminBundles}', {}, editor)).data
                        .shopAdminBundles.items.length,
                    1,
                );
                for (const q of [
                    'saveShopBundle(input:{})',
                    'saveShopGrowthSettings(input:{})',
                    'runShopCustomerNotifications',
                    'updateShopReturn(returnId:1,input:{},version:1)',
                    'publishSchoolQuote(quoteId:1,input:{},version:1,publish:true)',
                ])
                    await deny('mutation{' + q + '}', {}, editor);
                await deny(
                    'mutation($id:ID!){saveShopProductContent(productId:$id,languageCode:"en",input:{},version:0)}',
                    {id: f.product.id},
                    {admin: true, token: f.adminToken},
                );
            },
        );
        if (process.env.SUITE_GROWTH_BROWSER === 'true') {
            const {growthBrowserSuite} =
                await import('./testing/growth-browser-suite.mjs');
            await growthBrowserSuite(t, f, {
                token,
                other,
                bundle,
                order,
                quote,
                returnId,
            });
        }
    },
);
