import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {suiteFixture, waitFor} from './testing/suite-fixture.mjs';

const enabled = !!process.env.VENDURE_EMAIL_TEST_PORT;
test(
    'real MySQL shop operations: orders, private proofs, fulfillment gates, invoices, reviews, coupons, stock and reports',
    {skip: !enabled, timeout: 600000},
    async (t) => {
        const f = await suiteFixture(t);
        const token = await f.customer('suite-buyer@example.invalid');
        const other = await f.customer('suite-other@example.invalid');
        const shop = (q, v = {}, who = token) => f.query(q, v, {token: who});
        const denied = async (q, v = {}, options = {token: other}) =>
            assert.ok(
                (await f.raw(q, v, options)).errors,
                'request must be denied',
            );
        const inspect = async (id) =>
            (
                await f.admin(
                    'query($id:ID!){order(id:$id){id code state totalWithTax shippingWithTax lines{id quantity} payments{id state method} fulfillments{id state trackingCode}}}',
                    {id},
                )
            ).data.order;
        let cod, bank;
        await t.test(
            'wishlist belongs to verified account and channel',
            async () => {
                await denied(
                    'mutation($id:ID!){toggleWishlist(productId:$id)}',
                    {id: f.product.id},
                    {token: ''},
                );
                assert.deepEqual(
                    (
                        await shop(
                            'mutation($id:ID!){toggleWishlist(productId:$id)}',
                            {id: f.product.id},
                        )
                    ).data.toggleWishlist,
                    [f.product.id],
                );
                assert.deepEqual(
                    (await shop('{myWishlistIds}', {}, other)).data
                        .myWishlistIds,
                    [],
                );
                assert.equal(
                    (
                        await shop(
                            '{myWishlistProducts{id name variants{id priceWithTax}}}',
                        )
                    ).data.myWishlistProducts[0].id,
                    f.product.id,
                );
            },
        );
        await t.test(
            'native percentage coupon applies correctly to real order',
            async () => {
                const created = (
                    await f.admin(
                        'mutation($input:JSON!){createShopCoupon(input:$input)}',
                        {
                            input: {
                                name: 'Suite synthetic 10 percent',
                                code: 'SUITE10',
                                percent: 10,
                                minimum: 5000,
                                usageLimit: 2,
                                enabled: true,
                            },
                        },
                    )
                ).data.createShopCoupon;
                assert.equal(created.enabled, true);
            },
        );
        async function place(method, who = token, coupon) {
            const added = (
                await shop(
                    'mutation($id:ID!){addItemToOrder(productVariantId:$id,quantity:1){__typename ... on Order{id code} ... on ErrorResult{message}}}',
                    {id: f.variant.id},
                    who,
                )
            ).data.addItemToOrder;
            assert.equal(added.__typename, 'Order', JSON.stringify(added));
            const address = (
                await shop(
                    'mutation($input:CreateAddressInput!){setOrderShippingAddress(input:$input){__typename ... on ErrorResult{message}}}',
                    {
                        input: {
                            fullName: 'Suite Buyer العميل',
                            streetLine1: 'Synthetic street 1',
                            city: 'Cairo',
                            province: 'القاهرة',
                            countryCode: 'EG',
                            phoneNumber: '01012345678',
                        },
                    },
                    who,
                )
            ).data.setOrderShippingAddress;
            assert.equal(address.__typename, 'Order', JSON.stringify(address));
            if (coupon) {
                const result = (
                    await shop(
                        'mutation($code:String!){applyCouponCode(couponCode:$code){__typename ... on ErrorResult{message}}}',
                        {code: coupon},
                        who,
                    )
                ).data.applyCouponCode;
                assert.equal(
                    result.__typename,
                    'Order',
                    JSON.stringify(result),
                );
            }
            const shipping = (
                await shop(
                    'mutation($id:ID!){setOrderShippingMethod(shippingMethodId:[$id]){__typename ... on ErrorResult{message}}}',
                    {id: f.shipping.id},
                    who,
                )
            ).data.setOrderShippingMethod;
            assert.equal(shipping.__typename, 'Order');
            const transition = (
                await shop(
                    'mutation{transitionOrderToState(state:"ArrangingPayment"){__typename ... on ErrorResult{message}}}',
                    {},
                    who,
                )
            ).data.transitionOrderToState;
            assert.equal(
                transition.__typename,
                'Order',
                JSON.stringify(transition),
            );
            const placed = (
                await shop(
                    'mutation($method:String!){addPaymentToOrder(input:{method:$method,metadata:{}}){__typename ... on Order{id code state totalWithTax payments{id state}} ... on ErrorResult{message}}}',
                    {method},
                    who,
                )
            ).data.addPaymentToOrder;
            assert.equal(placed.__typename, 'Order', JSON.stringify(placed));
            assert.equal(placed.state, 'PaymentAuthorized');
            assert.equal(placed.payments[0].state, 'Authorized');
            return placed;
        }
        await t.test(
            'phone confirmation protects both operations and native fulfillment',
            async () => {
                cod = await place('cash-on-delivery', token, 'SUITE10');
                assert.equal(cod.totalWithTax, 20500);
                await denied('query($id:ID!){myOrderOperations(orderId:$id)}', {
                    id: cod.id,
                });
                await denied(
                    'query($id:ID!){myOrderInvoice(orderId:$id)}',
                    {id: cod.id},
                    {token},
                );
                const native = (
                    await f.admin(
                        'mutation($input:FulfillOrderInput!){addFulfillmentToOrder(input:$input){__typename ... on Fulfillment{id state} ... on ErrorResult{message}}}',
                        {
                            input: {
                                lines: (await inspect(cod.id)).lines.map(
                                    (l) => ({
                                        orderLineId: l.id,
                                        quantity: l.quantity,
                                    }),
                                ),
                                handler: {
                                    code: 'manual-fulfillment',
                                    arguments: [
                                        {name: 'method', value: 'aramex'},
                                        {
                                            name: 'trackingCode',
                                            value: 'SUITE-NATIVE',
                                        },
                                    ],
                                },
                            },
                        },
                    )
                ).data.addFulfillmentToOrder;
                assert.notEqual(
                    native.__typename,
                    'Fulfillment',
                    'native Orders UI cannot bypass telephone gate',
                );
                assert.equal(
                    (await inspect(cod.id)).fulfillments.length,
                    0,
                    'a rejected fulfillment must not leave a Created record',
                );
                const globalChannel = (
                    await f.admin('{channels{items{code token}}}')
                ).data.channels.items.find(
                    (c) => c.code === '__default_channel__',
                );
                const globalNative = (
                    await f.admin(
                        'mutation($input:FulfillOrderInput!){addFulfillmentToOrder(input:$input){__typename ... on Fulfillment{id} ... on ErrorResult{message}}}',
                        {
                            input: {
                                lines: (await inspect(cod.id)).lines.map(
                                    (l) => ({
                                        orderLineId: l.id,
                                        quantity: l.quantity,
                                    }),
                                ),
                                handler: {
                                    code: 'manual-fulfillment',
                                    arguments: [],
                                },
                            },
                        },
                        {channel: globalChannel.token},
                    )
                ).data.addFulfillmentToOrder;
                assert.notEqual(
                    globalNative.__typename,
                    'Fulfillment',
                    'the global default channel cannot bypass the Egypt shipping gate',
                );
                await denied(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"aramex",trackingCode:"SUITE123")}',
                    {id: cod.id},
                    {admin: true, token: f.adminToken},
                );
                const state = (
                    await f.admin(
                        'mutation($id:ID!){updateOrderCallback(orderId:$id,status:"confirmed",notes:"Private telephone confirmation",version:0)}',
                        {id: cod.id},
                    )
                ).data.updateOrderCallback;
                assert.equal(state.phoneStatus, 'confirmed');
                await denied(
                    'mutation($id:ID!){updateOrderCallback(orderId:$id,status:"pending",notes:"stale",version:0)}',
                    {id: cod.id},
                    {admin: true, token: f.adminToken},
                );
                const publicState = (
                    await shop(
                        'query($id:ID!){myOrderOperations(orderId:$id)}',
                        {id: cod.id},
                    )
                ).data.myOrderOperations;
                assert.equal(publicState.notes, undefined);
                assert.equal(publicState.phoneStatus, 'confirmed');
                await f.admin(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"aramex",trackingCode:"SUITE123")}',
                    {id: cod.id},
                );
                const shipped = await inspect(cod.id);
                assert.equal(shipped.state, 'Shipped');
                assert.equal(
                    shipped.payments[0].state,
                    'Authorized',
                    'dispatch must not collect COD',
                );
                await denied(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"aramex",trackingCode:"SUITE456")}',
                    {id: cod.id},
                    {admin: true, token: f.adminToken},
                );
                const follow = (
                    await shop(
                        'query($id:ID!){myOrderOperations(orderId:$id)}',
                        {id: cod.id},
                    )
                ).data.myOrderOperations;
                assert.match(follow.shipments[0].trackingUrl, /aramex/);
                assert.equal(follow.shipments[0].trackingCode, 'SUITE123');
            },
        );
        await t.test(
            'private multipart receipt, explicit bank verification and rejection',
            async () => {
                bank = await place('bank-transfer');
                assert.equal(bank.totalWithTax, 21500);
                await denied(
                    'mutation($id:ID!){submitTransferProof(orderId:$id,reference:"OTHER-USER")}',
                    {id: bank.id},
                );
                const png = await sharp({
                    create: {
                        width: 100,
                        height: 60,
                        channels: 3,
                        background: '#edf8ff',
                    },
                })
                    .png()
                    .toBuffer();
                const form = new FormData();
                form.set(
                    'operations',
                    JSON.stringify({
                        query: 'mutation($id:ID!,$file:Upload){submitTransferProof(orderId:$id,reference:"SUITE-TRANSFER",file:$file)}',
                        variables: {id: bank.id, file: null},
                    }),
                );
                form.set('map', JSON.stringify({0: ['variables.file']}));
                form.set(
                    '0',
                    new Blob([png], {type: 'image/png'}),
                    'suite-receipt.png',
                );
                const upload = await fetch(f.url(false), {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token,
                        'vendure-token': f.channelToken,
                        'Apollo-Require-Preflight': 'true',
                    },
                    body: form,
                });
                const uploaded = await upload.json();
                assert.equal(
                    uploaded.errors,
                    undefined,
                    JSON.stringify(uploaded),
                );
                assert.equal(
                    uploaded.data.submitTransferProof.receiptStatus,
                    'pending',
                );
                for (const [buffer, mime] of [
                    [Buffer.from('<svg onload="alert(1)"/>'), 'image/png'],
                    [png.subarray(0, 8), 'image/png'],
                    [png, 'image/svg+xml'],
                    [
                        Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]),
                        'image/png',
                    ],
                ]) {
                    const invalid = new FormData();
                    invalid.set(
                        'operations',
                        JSON.stringify({
                            query: 'mutation($id:ID!,$file:Upload){submitTransferProof(orderId:$id,file:$file)}',
                            variables: {id: bank.id, file: null},
                        }),
                    );
                    invalid.set('map', JSON.stringify({0: ['variables.file']}));
                    invalid.set(
                        '0',
                        new Blob([buffer], {type: mime}),
                        'unsafe-receipt.png',
                    );
                    const rejected = await fetch(f.url(false), {
                        method: 'POST',
                        headers: {
                            Authorization: 'Bearer ' + token,
                            'vendure-token': f.channelToken,
                            'Apollo-Require-Preflight': 'true',
                        },
                        body: invalid,
                    });
                    assert.ok(
                        (await rejected.json()).errors,
                        'invalid receipt must be rejected',
                    );
                }
                assert.equal(
                    (await inspect(bank.id)).payments[0].state,
                    'Authorized',
                    'proof never auto-settles',
                );
                const files = await fs.readdir(
                    path.join(f.root, 'private-receipts'),
                );
                assert.equal(files.length, 1);
                assert.equal(
                    (
                        await fs.stat(
                            path.join(f.root, 'private-receipts', files[0]),
                        )
                    ).mode & 0o777,
                    0o600,
                );
                assert.equal(
                    (
                        await fetch(
                            `http://127.0.0.1:${f.port}/assets/${files[0]}`,
                        )
                    ).status,
                    404,
                    'proof must not be a public asset',
                );
                const proof = (
                    await f.admin(
                        'query($id:ID!){shopTransferReceipt(orderId:$id)}',
                        {id: bank.id},
                    )
                ).data.shopTransferReceipt;
                assert.deepEqual(Buffer.from(proof.dataBase64, 'base64'), png);
                await f.admin(
                    'mutation($id:ID!){rejectShopTransferProof(orderId:$id,note:"Reference does not match")}',
                    {id: bank.id},
                );
                const rejected = (
                    await shop(
                        'query($id:ID!){myOrderOperations(orderId:$id)}',
                        {id: bank.id},
                    )
                ).data.myOrderOperations;
                assert.equal(
                    rejected.receiptReviewNote,
                    'Reference does not match',
                );
                await shop(
                    'mutation($id:ID!){submitTransferProof(orderId:$id,reference:"SUITE-CORRECTED")}',
                    {id: bank.id},
                );
                const state = (
                    await f.admin(
                        'query($id:ID!){shopOperationsOrder(orderId:$id)}',
                        {id: bank.id},
                    )
                ).data.shopOperationsOrder;
                await f.admin(
                    'mutation($id:ID!,$version:Int!){updateOrderCallback(orderId:$id,status:"confirmed",notes:"Bank customer confirmed",version:$version)}',
                    {id: bank.id, version: state.version},
                );
                await denied(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"aramex",trackingCode:"BANK123")}',
                    {id: bank.id},
                    {admin: true, token: f.adminToken},
                );
                await denied(
                    'mutation($id:ID!){verifyShopTransfer(orderId:$id,reference:"SUITE-CORRECTED",confirmFundsReceived:false)}',
                    {id: bank.id},
                    {admin: true, token: f.adminToken},
                );
                await f.admin(
                    'mutation($id:ID!){verifyShopTransfer(orderId:$id,reference:"SUITE-CORRECTED",confirmFundsReceived:true)}',
                    {id: bank.id},
                );
                assert.equal(
                    (await inspect(bank.id)).payments[0].state,
                    'Settled',
                );
                await denied(
                    'mutation($id:ID!){submitTransferProof(orderId:$id,reference:"TOO-LATE")}',
                    {id: bank.id},
                    {token},
                );
                await f.admin(
                    'mutation($id:ID!){dispatchShopOrder(orderId:$id,carrier:"dhl",trackingCode:"BANK123")}',
                    {id: bank.id},
                );
            },
        );
        await t.test(
            'PDF contains immutable actual order snapshot and scoped owner access',
            async () => {
                const settings = {
                    sellerName: 'Suite synthetic seller شركة اختبار',
                    sellerAddress: 'Synthetic Cairo address',
                    sellerTaxId: 'TEST-NOT-REAL',
                    invoicePrefix: 'TEST',
                    lowStockEnabled: false,
                    lowStockThreshold: 5,
                    notificationEmail: '',
                };
                await f.admin(
                    'mutation($input:JSON!){saveShopOperationsSettings(input:$input)}',
                    {input: settings},
                );
                const invoice = (
                    await shop('query($id:ID!){myOrderInvoice(orderId:$id)}', {
                        id: cod.id,
                    })
                ).data.myOrderInvoice;
                const pdf = Buffer.from(invoice.dataBase64, 'base64');
                assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
                if (process.env.SUITE_ARTIFACT_DIR) {
                    await fs.mkdir(process.env.SUITE_ARTIFACT_DIR, {
                        recursive: true,
                    });
                    await fs.writeFile(
                        path.join(
                            process.env.SUITE_ARTIFACT_DIR,
                            'operations-invoice-sample.pdf',
                        ),
                        pdf,
                    );
                }
                const [[before]] = await f.control.query(
                    'SELECT snapshot FROM vendure_suite_ci.sv_order_invoice WHERE orderId=?',
                    [cod.id],
                );
                const snapshot = JSON.parse(before.snapshot);
                assert.equal(snapshot.total, 20500);
                assert.equal(snapshot.itemsTotal, 9000);
                assert.equal(snapshot.lines[0].total, 9000);
                assert.equal(snapshot.lines[0].name, 'Suite Test Robot');
                assert.equal(snapshot.shipping, 11500);
                await f.admin(
                    'mutation($input:JSON!){saveShopOperationsSettings(input:$input)}',
                    {input: {...settings, sellerName: 'CHANGED seller'}},
                );
                await shop('query($id:ID!){myOrderInvoice(orderId:$id)}', {
                    id: cod.id,
                });
                const [[after]] = await f.control.query(
                    'SELECT snapshot FROM vendure_suite_ci.sv_order_invoice WHERE orderId=?',
                    [cod.id],
                );
                assert.equal(after.snapshot, before.snapshot);
                await denied('query($id:ID!){myOrderInvoice(orderId:$id)}', {
                    id: cod.id,
                });
            },
        );
        await t.test(
            'reviews require delivered purchase and renewed moderation after editing',
            async () => {
                await denied(
                    'mutation($id:ID!){submitProductReview(productId:$id,rating:5,text:"not delivered")}',
                    {id: f.product.id},
                    {token},
                );
                const shipped = await inspect(cod.id);
                const delivered = (
                    await f.admin(
                        'mutation($id:ID!){transitionFulfillmentToState(id:$id,state:"Delivered"){__typename ... on Fulfillment{state} ... on ErrorResult{message}}}',
                        {id: shipped.fulfillments[0].id},
                    )
                ).data.transitionFulfillmentToState;
                assert.equal(
                    delivered.state,
                    'Delivered',
                    JSON.stringify(delivered),
                );
                assert.equal((await inspect(cod.id)).state, 'Delivered');
                await denied(
                    'mutation($id:ID!){submitProductReview(productId:$id,rating:5,text:"not my purchase")}',
                    {id: f.product.id},
                );
                await shop(
                    'mutation($id:ID!){submitProductReview(productId:$id,rating:5,text:"Great robot <script>alert(1)</script>")}',
                    {id: f.product.id},
                );
                assert.equal(
                    (
                        await shop(
                            'query($id:ID!){productReviews(productId:$id)}',
                            {id: f.product.id},
                        )
                    ).data.productReviews.total,
                    0,
                );
                let review = (
                    await f.admin('{shopProductReviews(status:"pending")}')
                ).data.shopProductReviews.items[0];
                await shop(
                    'mutation($id:ID!){submitProductReview(productId:$id,rating:4,text:"Edited verified review")}',
                    {id: f.product.id},
                );
                await denied(
                    'mutation($id:ID!,$version:Int!){moderateShopReview(reviewId:$id,status:"approved",version:$version)}',
                    {id: review.id, version: review.version},
                    {admin: true, token: f.adminToken},
                );
                review = (
                    await f.admin('{shopProductReviews(status:"pending")}')
                ).data.shopProductReviews.items[0];
                await f.admin(
                    'mutation($id:ID!,$version:Int!){moderateShopReview(reviewId:$id,status:"approved",version:$version)}',
                    {id: review.id, version: review.version},
                );
                const published = (
                    await shop(
                        'query($id:ID!){productReviews(productId:$id)}',
                        {id: f.product.id},
                    )
                ).data.productReviews;
                assert.equal(published.average, 4);
                assert.equal(published.items[0].verifiedPurchase, true);
                assert.equal(published.items[0].email, undefined);
            },
        );
        await t.test(
            'reports reflect real payment state, discounts and native inventory',
            async () => {
                const report = (
                    await f.admin(
                        'query($from:String!,$to:String!){shopSalesReport(from:$from,to:$to)}',
                        {
                            from: new Date(Date.now() - 86400000).toISOString(),
                            to: new Date(Date.now() + 86400000).toISOString(),
                        },
                    )
                ).data.shopSalesReport;
                assert.equal(report.orderCount, 2);
                assert.equal(report.gross, 42000);
                assert.equal(report.collected, 21500);
                assert.equal(report.pending, 20500);
                assert.equal(report.topProducts[0].quantity, 2);
                assert.equal(report.topProducts[0].name, 'Suite Test Robot');
            },
        );
        await t.test(
            'low stock notification is opt-in, deduplicated and resets after replenishment',
            async () => {
                const updateStock = async (n) =>
                    f.admin(
                        'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                        {
                            input: [
                                {
                                    id: f.variant.id,
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
                await f.admin(
                    'mutation($input:JSON!){saveShopOperationsSettings(input:$input)}',
                    {
                        input: {
                            sellerName: 'Suite seller',
                            sellerAddress: 'Synthetic address',
                            sellerTaxId: '',
                            invoicePrefix: 'TEST',
                            lowStockEnabled: true,
                            lowStockThreshold: 5,
                            notificationEmail: 'suite-stock@example.invalid',
                        },
                    },
                );
                await updateStock(3);
                await f.admin('mutation{checkShopLowStock}');
                const alerts = () =>
                    f.smtp.messages.filter((m) =>
                        m.recipients.some((r) =>
                            r.includes('suite-stock@example.invalid'),
                        ),
                    );
                await waitFor(
                    () => alerts().length === 1,
                    'Low stock mail missing',
                );
                await f.admin('mutation{checkShopLowStock}');
                assert.equal(alerts().length, 1);
                await updateStock(20);
                await f.admin('mutation{checkShopLowStock}');
                await updateStock(3);
                await f.admin('mutation{checkShopLowStock}');
                await waitFor(
                    () => alerts().length === 2,
                    'Replenishment did not reset stock alert',
                );
            },
        );
        await t.test(
            'channel boundaries and staff permissions hold on every private operation',
            async () => {
                const active = (
                    await f.admin(
                        '{activeChannel{seller{id} defaultTaxZone{id} defaultShippingZone{id}}}',
                    )
                ).data.activeChannel;
                const created = (
                    await f.admin(
                        'mutation($input:CreateChannelInput!){createChannel(input:$input){__typename ... on Channel{id token} ... on ErrorResult{message}}}',
                        {
                            input: {
                                code: 'suite-unrelated',
                                token: 'suite-unrelated-token',
                                defaultLanguageCode: 'en',
                                availableLanguageCodes: ['en'],
                                defaultCurrencyCode: 'EGP',
                                availableCurrencyCodes: ['EGP'],
                                pricesIncludeTax: true,
                                sellerId: active.seller.id,
                                defaultTaxZoneId: active.defaultTaxZone.id,
                                defaultShippingZoneId:
                                    active.defaultShippingZone.id,
                            },
                        },
                    )
                ).data.createChannel;
                assert.equal(
                    created.__typename,
                    'Channel',
                    JSON.stringify(created),
                );
                const defaultChannel = created;
                for (const q of [
                    'shopOperationsOrder(orderId:$id)',
                    'shopTransferReceipt(orderId:$id)',
                    'shopOrderInvoice(orderId:$id)',
                ]) {
                    await denied(
                        `query($id:ID!){${q}}`,
                        {id: bank.id},
                        {
                            admin: true,
                            token: f.adminToken,
                            channel: defaultChannel.token,
                        },
                    );
                }
                assert.deepEqual(
                    (
                        await f.admin(
                            '{shopOperationsOrders}',
                            {},
                            {channel: defaultChannel.token},
                        )
                    ).data.shopOperationsOrders.items,
                    [],
                );
                assert.deepEqual(
                    (
                        await f.query(
                            '{myWishlistIds}',
                            {},
                            {token, channel: defaultChannel.token},
                        )
                    ).data.myWishlistIds,
                    [],
                );
                const role = (
                    await f.admin(
                        'mutation($input:CreateRoleInput!){createRole(input:$input){id}}',
                        {
                            input: {
                                code: 'suite-catalog-reader',
                                description: 'Synthetic least privilege test',
                                permissions: ['ReadCatalog'],
                                channelIds: [f.channel.id],
                            },
                        },
                    )
                ).data.createRole;
                await f.admin(
                    'mutation($input:CreateAdministratorInput!){createAdministrator(input:$input){id}}',
                    {
                        input: {
                            emailAddress: 'suite-reader@example.invalid',
                            firstName: 'Suite',
                            lastName: 'Reader',
                            password: 'suite-reader-password',
                            roleIds: [role.id],
                        },
                    },
                );
                const signed = await f.query(
                    'mutation{login(username:"suite-reader@example.invalid",password:"suite-reader-password"){__typename ... on CurrentUser{id}}}',
                    {},
                    {admin: true},
                );
                assert.ok(signed.token);
                const restricted = {admin: true, token: signed.token};
                assert.equal(
                    (await f.query('{shopOperationsInventory}', {}, restricted))
                        .data.shopOperationsInventory.items.length,
                    1,
                );
                for (const q of [
                    'shopOperationsOrder(orderId:$id)',
                    'shopTransferReceipt(orderId:$id)',
                    'shopOrderInvoice(orderId:$id)',
                ])
                    await denied(
                        `query($id:ID!){${q}}`,
                        {id: bank.id},
                        restricted,
                    );
                await denied(
                    'mutation($id:ID!){verifyShopTransfer(orderId:$id,reference:"UNAUTHORIZED",confirmFundsReceived:true)}',
                    {id: bank.id},
                    restricted,
                );
                await denied('mutation{checkShopLowStock}', {}, restricted);
                f.reader = {
                    token: signed.token,
                    username: 'suite-reader@example.invalid',
                    password: 'suite-reader-password',
                };
            },
        );
        await t.test(
            'COD collection after delivery preserves delivery state and settled refunds reduce collection',
            async () => {
                const order = await inspect(cod.id);
                const settled = (
                    await f.admin(
                        'mutation($id:ID!){settlePayment(id:$id){__typename ... on Payment{state} ... on ErrorResult{message}}}',
                        {id: order.payments[0].id},
                    )
                ).data.settlePayment;
                assert.equal(settled.state, 'Settled', JSON.stringify(settled));
                assert.equal((await inspect(cod.id)).state, 'Delivered');
                const refunded = (
                    await f.admin(
                        'mutation($input:RefundOrderInput!){refundOrder(input:$input){__typename ... on Refund{id state total} ... on ErrorResult{message}}}',
                        {
                            input: {
                                paymentId: bank.payments[0].id,
                                amount: 500,
                                reason: 'Synthetic test manual refund',
                            },
                        },
                    )
                ).data.refundOrder;
                assert.equal(
                    refunded.__typename,
                    'Refund',
                    JSON.stringify(refunded),
                );
                if (refunded.state === 'Pending')
                    await f.admin(
                        'mutation($input:SettleRefundInput!){settleRefund(input:$input){__typename ... on Refund{state} ... on ErrorResult{message}}}',
                        {
                            input: {
                                id: refunded.id,
                                transactionId: 'SUITE-REFUND-RECEIVED',
                            },
                        },
                    );
                const report = (
                    await f.admin(
                        'query($from:String!,$to:String!){shopSalesReport(from:$from,to:$to)}',
                        {
                            from: new Date(Date.now() - 86400000).toISOString(),
                            to: new Date(Date.now() + 86400000).toISOString(),
                        },
                    )
                ).data.shopSalesReport;
                assert.equal(report.collected, 41500);
                assert.equal(report.refunded, 500);
                assert.equal(report.pending, 0);
                assert.equal(report.gross, 42000);
            },
        );
        if (process.env.SUITE_BROWSER === 'true') {
            const pendingBank = await place('bank-transfer');
            const {browserSuite} = await import('./testing/browser-suite.mjs');
            await browserSuite(t, f, {token, other, cod, bank, pendingBank});
        }
    },
);
