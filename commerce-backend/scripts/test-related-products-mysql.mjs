import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {chromium} from '../../node_modules/playwright/index.mjs';
import {suiteFixture, waitFor} from './testing/suite-fixture.mjs';

test(
    'related products use real collection membership and preserve product-page browsing',
    {skip: !process.env.VENDURE_EMAIL_TEST_PORT, timeout: 300000},
    async (t) => {
        const f = await suiteFixture(t),
            root = path.resolve(process.cwd(), '..');
        const artifacts =
            process.env.SUITE_ARTIFACT_DIR ||
            path.join(f.root, 'related-artifacts');
        await fs.mkdir(artifacts, {recursive: true});
        async function product(name, enabled = true) {
            const p = (
                await f.admin(
                    'mutation($input:CreateProductInput!){createProduct(input:$input){id slug}}',
                    {
                        input: {
                            enabled,
                            translations: [
                                {
                                    languageCode: 'en',
                                    name,
                                    slug: name
                                        .toLowerCase()
                                        .replaceAll(' ', '-'),
                                    description:
                                        'Synthetic recommendation fixture',
                                },
                            ],
                        },
                    },
                )
            ).data.createProduct;
            const v = (
                await f.admin(
                    'mutation($input:[CreateProductVariantInput!]!){createProductVariants(input:$input){id}}',
                    {
                        input: [
                            {
                                productId: p.id,
                                sku: p.slug,
                                price: 5000,
                                trackInventory: 'TRUE',
                                stockLevels: [
                                    {
                                        stockLocationId: f.location.id,
                                        stockOnHand: 5,
                                    },
                                ],
                                translations: [{languageCode: 'en', name}],
                            },
                        ],
                    },
                )
            ).data.createProductVariants[0];
            return {...p, variantId: v.id};
        }
        const siblings = [];
        for (let i = 0; i < 5; i++)
            siblings.push(await product('Related Robot ' + i));
        const broad = await product('Broad Collection Product'),
            loose = await product('Unclassified Kit'),
            disabled = await product('Disabled Robot', false);
        const collection = async (name, ids, parentId) =>
            (
                await f.admin(
                    'mutation($input:CreateCollectionInput!){createCollection(input:$input){id}}',
                    {
                        input: {
                            ...(parentId ? {parentId} : {}),
                            inheritFilters: false,
                            translations: [
                                {
                                    languageCode: 'en',
                                    name,
                                    slug: name
                                        .toLowerCase()
                                        .replaceAll(' ', '-'),
                                    description: '',
                                },
                            ],
                            filters: [
                                {
                                    code: 'variant-id-filter',
                                    arguments: [
                                        {
                                            name: 'variantIds',
                                            value: JSON.stringify(ids),
                                        },
                                        {name: 'combineWithAnd', value: 'true'},
                                    ],
                                },
                            ],
                        },
                    },
                )
            ).data.createCollection;
        const groupIds = [
            f.variant.id,
            ...siblings.map((s) => s.variantId),
            disabled.variantId,
        ];
        const parent = await collection('A Broad Collection', [
            ...groupIds,
            broad.variantId,
        ]);
        const child = await collection('Z Robot Kits', groupIds, parent.id);
        await collection('Another Membership', [
            f.variant.id,
            siblings[0].variantId,
            siblings[1].variantId,
        ]);
        await waitFor(async () => {
            const r = await f.query(
                'query($id:ID!){search(input:{collectionId:$id,groupByProduct:true,take:20}){items{productId}}}',
                {id: child.id},
            );
            return r.data.search.items.length === 6;
        }, 'Collection/search indexing did not finish');
        await f.query(
            'query($id:ID!){product(id:$id){id collections{id breadcrumbs{id}}}}',
            {id: f.product.id},
        );
        const active = (
            await f.admin(
                '{activeChannel{seller{id} defaultTaxZone{id} defaultShippingZone{id}}}',
            )
        ).data.activeChannel;
        const foreign = (
            await f.admin(
                'mutation($input:CreateChannelInput!){createChannel(input:$input){__typename ... on Channel{token}}}',
                {
                    input: {
                        code: 'related-foreign',
                        token: 'related-foreign-token',
                        defaultLanguageCode: 'en',
                        availableLanguageCodes: ['en'],
                        defaultCurrencyCode: 'EGP',
                        availableCurrencyCodes: ['EGP'],
                        sellerId: active.seller.id,
                        defaultTaxZoneId: active.defaultTaxZone.id,
                        defaultShippingZoneId: active.defaultShippingZone.id,
                        pricesIncludeTax: false,
                    },
                },
            )
        ).data.createChannel;
        const foreignProduct = (
            await f.admin(
                'mutation{createProduct(input:{enabled:true,translations:[{languageCode:en,name:"Foreign only",slug:"foreign-only",description:"Synthetic"}]}){id}}',
                {},
                {channel: foreign.token},
            )
        ).data.createProduct;
        const env = {
            ...process.env,
            VENDURE_SHOP_API_URL: `http://localhost:${f.port}/shop-api`,
            VENDURE_CHANNEL_TOKEN: f.channelToken,
            NEXT_TELEMETRY_DISABLED: '1',
            NEXT_PUBLIC_SHOW_STORE_POLICIES: 'false',
        };
        await t.test('storefront production build succeeds', async () => {
            const p = spawn('npm', ['run', 'build'], {
                cwd: root,
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let log = '';
            p.stdout.on('data', (b) => (log += b));
            p.stderr.on('data', (b) => (log += b));
            const [code] = await once(p, 'exit');
            await fs.writeFile(path.join(artifacts, 'build.log'), log);
            assert.equal(code, 0, log.slice(-6000));
        });
        const socket = net.createServer();
        await new Promise((r) => socket.listen(0, '127.0.0.1', r));
        const port = socket.address().port;
        await new Promise((r) => socket.close(r));
        const next = spawn(
            process.execPath,
            [
                path.join(root, 'node_modules/next/dist/bin/next'),
                'start',
                '--port',
                String(port),
                '--hostname',
                '127.0.0.1',
            ],
            {cwd: root, env, stdio: ['ignore', 'pipe', 'pipe']},
        );
        let logs = '',
            browser;
        next.stdout.on('data', (b) => (logs += b));
        next.stderr.on('data', (b) => (logs += b));
        t.after(async () => {
            if (browser) await browser.close();
            if (next.exitCode === null) {
                const stopped = once(next, 'exit');
                next.kill('SIGTERM');
                const timer = setTimeout(() => {
                    if (next.exitCode === null) next.kill('SIGKILL');
                }, 5000);
                await stopped;
                clearTimeout(timer);
            }
            await fs.writeFile(path.join(artifacts, 'runtime.log'), logs);
        });
        const origin = `http://127.0.0.1:${port}`,
            endpoint = (id) =>
                origin +
                '/api/catalog/related?' +
                new URLSearchParams({productId: id, locale: 'en'});
        await waitFor(async () => {
            try {
                return (await fetch(origin + '/en')).ok;
            } catch {
                return false;
            }
        }, 'Built storefront failed to start');
        await t.test(
            'specific collection wins, current product and disabled products are excluded, and at most four unique cards are returned',
            async () => {
                const r = await fetch(endpoint(f.product.id));
                assert.equal(r.status, 200);
                assert.match(r.headers.get('cache-control'), /no-store/);
                const data = await r.json();
                assert.equal(data.related, true);
                assert.equal(data.items.length, 4);
                const ids = data.items.map((i) => i.productId);
                assert.equal(new Set(ids).size, 4);
                assert.ok(ids.every((id) => siblings.some((s) => s.id === id)));
                assert.ok(data.items.every((i) => i.currencyCode === 'EGP'));
            },
        );
        await t.test(
            'unclassified products get a clearly distinguished general-catalog fallback',
            async () => {
                const r = await fetch(endpoint(loose.id));
                assert.equal(r.status, 200);
                const data = await r.json();
                assert.equal(data.related, false);
                assert.equal(data.items.length, 4);
                assert.ok(
                    data.items.every(
                        (i) =>
                            i.productId !== loose.id &&
                            i.productId !== disabled.id,
                    ),
                );
            },
        );
        await t.test(
            'invalid, missing, disabled and other-channel source products are not accepted',
            async () => {
                for (const [id, status] of [
                    ['invalid', 400],
                    ['9999999', 404],
                    [disabled.id, 404],
                    [foreignProduct.id, 404],
                ])
                    assert.equal(
                        (await fetch(endpoint(id))).status,
                        status,
                        'Source ID ' + id,
                    );
            },
        );
        browser = await chromium.launch({
            executablePath:
                process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        });
        const page = await browser.newPage({
            viewport: {width: 1440, height: 1000},
        });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await t.test(
            'related cards, prices, wishlist hearts and comparison controls render on the built product page',
            async () => {
                await page.goto(origin + '/en/product/' + f.product.slug);
                const section = page.locator('#related-products');
                await section
                    .getByRole('heading', {
                        name: 'Related Products',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(await section.getByRole('article').count(), 4);
                assert.equal(
                    await section
                        .getByRole('button', {
                            name: 'Save to wishlist',
                            exact: true,
                        })
                        .count(),
                    4,
                );
                assert.equal(
                    await section
                        .getByRole('button', {
                            name: 'Add to comparison',
                            exact: true,
                        })
                        .count(),
                    4,
                );
                assert.ok(
                    await section.getByText('EGP', {exact: false}).count(),
                );
                assert.equal(
                    await section
                        .getByRole('link', {
                            name: 'View All Products',
                            exact: true,
                        })
                        .getAttribute('href'),
                    '/en/search',
                );
                await section.screenshot({
                    path: path.join(artifacts, 'related-desktop.png'),
                });
            },
        );
        await t.test(
            'a product without a collection still displays the fallback section and mobile cards fit the viewport',
            async () => {
                await page.setViewportSize({width: 390, height: 844});
                await page.goto(origin + '/en/product/' + loose.slug);
                const section = page.locator('#related-products');
                await section
                    .getByRole('heading', {
                        name: 'Explore more products',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(await section.getByRole('article').count(), 4);
                assert.ok(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                );
                await section.screenshot({
                    path: path.join(artifacts, 'related-mobile.png'),
                });
            },
        );
        await t.test(
            'a failed recommendation request leaves the product usable',
            async () => {
                await page.route('**/api/catalog/related?**', (route) =>
                    route.fulfill({
                        status: 503,
                        contentType: 'application/json',
                        body: '{"error":true}',
                    }),
                );
                await page.goto(origin + '/en/product/' + loose.slug);
                await page
                    .getByRole('heading', {
                        name: 'Unclassified Kit',
                        exact: true,
                    })
                    .waitFor();
                await page
                    .getByRole('button', {name: 'Add to Cart', exact: true})
                    .waitFor();
                assert.equal(
                    await page.locator('#related-products').count(),
                    0,
                );
                assert.deepEqual(errors, []);
                await page.unroute('**/api/catalog/related?**');
            },
        );
        await t.test(
            'the section is empty when the source product is the only remaining visible product',
            async () => {
                for (const p of [f.product, ...siblings, broad, disabled])
                    await f.admin(
                        'mutation($input:UpdateProductInput!){updateProduct(input:$input){id}}',
                        {input: {id: p.id, enabled: false}},
                    );
                await waitFor(async () => {
                    const r = await f.query(
                        '{search(input:{groupByProduct:true,take:20}){items{productId}}}',
                    );
                    return r.data.search.items.length === 1;
                }, 'Visibility reindex did not finish');
                const data = await (await fetch(endpoint(loose.id))).json();
                assert.deepEqual(data.items, []);
                assert.equal(data.related, false);
            },
        );
    },
);
