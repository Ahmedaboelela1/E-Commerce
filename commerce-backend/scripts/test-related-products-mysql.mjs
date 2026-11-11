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
    'native product browsing: recommendations, recent history, search and filters',
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
        const extraCatalog = [];
        for (let i = 0; i < 8; i++)
            extraCatalog.push(await product('Catalog Item ' + i));
        for (let i = 0; i < siblings.length; i++)
            await f.admin(
                'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            id: siblings[i].variantId,
                            price: (i + 1) * 1000,
                            stockLevels: [
                                {
                                    stockLocationId: f.location.id,
                                    stockOnHand: i === 4 ? 0 : 5,
                                },
                            ],
                        },
                    ],
                },
            );
        for (let i = 0; i < extraCatalog.length; i++)
            await f.admin(
                'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            id: extraCatalog[i].variantId,
                            price: 12000 + i * 1000,
                        },
                    ],
                },
            );
        const createFacet = async (code, names) =>
            (
                await f.admin(
                    'mutation($input:CreateFacetInput!){createFacet(input:$input){id values{id code}}}',
                    {
                        input: {
                            code,
                            isPrivate: false,
                            translations: [{languageCode: 'en', name: code}],
                            values: names.map((name) => ({
                                code: name.toLowerCase(),
                                translations: [{languageCode: 'en', name}],
                            })),
                        },
                    },
                )
            ).data.createFacet;
        const brand = await createFacet('Brand', ['Alpha', 'Beta']),
            level = await createFacet('Level', ['Starter', 'Advanced']);
        for (let i = 0; i < 4; i++)
            await f.admin(
                'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            id: siblings[i].variantId,
                            facetValueIds: [
                                brand.values[i < 2 ? 0 : 1].id,
                                level.values[i % 2 === 0 ? 0 : 1].id,
                            ],
                        },
                    ],
                },
            );
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
            'recent history records recency, excludes the current product and persists on home/reload',
            async () => {
                await page.setViewportSize({width: 1440, height: 1000});
                const key = 'skillverse.recent.v1.' + f.channel.id;
                for (const p of [
                    siblings[0],
                    siblings[1],
                    loose,
                    siblings[0],
                ]) {
                    await page.goto(origin + '/en/product/' + p.slug);
                    await waitFor(
                        () =>
                            page.evaluate(
                                ({key, id}) =>
                                    JSON.parse(
                                        localStorage.getItem(key) || '[]',
                                    )[0]?.id === id,
                                {key, id: p.id},
                            ),
                        'Visit was not recorded',
                    );
                }
                const section = page.locator('#recently-viewed');
                await section
                    .getByRole('heading', {
                        name: 'Recently viewed',
                        exact: true,
                    })
                    .waitFor();
                const ids = await section
                    .locator('article a[href*="/product/"]')
                    .evaluateAll((nodes) =>
                        nodes.map((n) => n.getAttribute('href')),
                    );
                assert.deepEqual(ids, [
                    '/en/product/' + loose.slug,
                    '/en/product/' + siblings[1].slug,
                    '/en/product/' + f.product.slug,
                ]);
                await page.goto(origin + '/en');
                const home = page.locator('#recently-viewed');
                await home
                    .getByRole('heading', {
                        name: 'Recently viewed',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(
                    await home
                        .locator('article a[href*="/product/"]')
                        .first()
                        .getAttribute('href'),
                    '/en/product/' + siblings[0].slug,
                );
                await page.reload();
                await home
                    .getByRole('heading', {
                        name: 'Recently viewed',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(
                    await home
                        .locator('article a[href*="/product/"]')
                        .first()
                        .getAttribute('href'),
                    '/en/product/' + siblings[0].slug,
                );
                await home.screenshot({
                    path: path.join(artifacts, 'recent-history-desktop.png'),
                });
            },
        );
        await t.test(
            'recent API preserves order and protects limits/disabled/other-channel products',
            async () => {
                const api = (ids) =>
                    origin +
                    '/api/catalog/recent?ids=' +
                    encodeURIComponent(ids.join(','));
                const response = await fetch(
                    api([
                        loose.id,
                        disabled.id,
                        foreignProduct.id,
                        siblings[1].id,
                        loose.id,
                    ]),
                );
                assert.equal(response.status, 200);
                assert.match(response.headers.get('cache-control'), /no-store/);
                assert.deepEqual(
                    (await response.json()).items.map((p) => p.id),
                    [loose.id, siblings[1].id],
                );
                assert.equal((await fetch(api(['invalid']))).status, 400);
                assert.equal(
                    (
                        await fetch(
                            api(
                                Array.from({length: 13}, (_, i) =>
                                    String(i + 1),
                                ),
                            ),
                        )
                    ).status,
                    400,
                );
            },
        );
        await t.test(
            'history expires, scopes channels, clears persistently and tolerates blocked storage',
            async () => {
                const key = 'skillverse.recent.v1.' + f.channel.id;
                await page.evaluate(
                    ({key, visible, expired}) => {
                        localStorage.setItem(
                            key,
                            JSON.stringify([
                                {
                                    id: expired,
                                    viewedAt: Date.now() - 31 * 86400000,
                                },
                                {id: visible, viewedAt: Date.now()},
                                {id: visible, viewedAt: Date.now()},
                            ]),
                        );
                        localStorage.setItem(
                            'skillverse.recent.v1.other-channel',
                            JSON.stringify([
                                {id: '999999', viewedAt: Date.now()},
                            ]),
                        );
                    },
                    {key, visible: loose.id, expired: siblings[1].id},
                );
                await page.goto(origin + '/en');
                const section = page.locator('#recently-viewed');
                await section
                    .getByRole('heading', {
                        name: 'Recently viewed',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(await section.getByRole('article').count(), 1);
                await section
                    .getByRole('button', {
                        name: 'Clear browsing history',
                        exact: true,
                    })
                    .click();
                assert.equal(
                    await page.evaluate(
                        (key) => localStorage.getItem(key),
                        key,
                    ),
                    null,
                );
                assert.ok(
                    await page.evaluate(() =>
                        localStorage.getItem(
                            'skillverse.recent.v1.other-channel',
                        ),
                    ),
                );
                await page.reload();
                assert.equal(await page.locator('#recently-viewed').count(), 0);
                const context = await browser.newContext();
                await context.addInitScript(() => {
                    Object.defineProperty(window, 'localStorage', {
                        get() {
                            throw new Error('Storage blocked');
                        },
                    });
                });
                const blocked = await context.newPage();
                blocked.setDefaultTimeout(15000);
                const failures = [];
                blocked.on('pageerror', (e) => failures.push(e.message));
                await blocked.goto(origin + '/en/product/' + loose.slug);
                await blocked
                    .getByRole('heading', {
                        name: 'Unclassified Kit',
                        exact: true,
                    })
                    .waitFor();
                assert.deepEqual(failures, []);
                await context.close();
            },
        );
        const catalogIds = () =>
            page
                .locator('article a[href*="/product/"]')
                .evaluateAll((nodes) =>
                    nodes.map((n) => n.getAttribute('href').split('/').at(-1)),
                );
        const waitCatalog = (expected) =>
            waitFor(
                async () => {
                    const ids = await catalogIds();
                    return (
                        ids.length === expected.length &&
                        ids.every((id, i) => id === expected[i])
                    );
                },
                'Catalog did not match ' + expected.join(','),
            );
        await t.test(
            'native prices sort in both directions before pagination and reset the selected page',
            async () => {
                await page.goto(origin + '/en/search?page=2');
                await page
                    .getByRole('combobox', {name: 'Sort by', exact: true})
                    .waitFor();
                await page
                    .getByRole('combobox', {name: 'Sort by', exact: true})
                    .selectOption('price-asc');
                await page.waitForURL(
                    (url) =>
                        url.searchParams.get('sort') === 'price-asc' &&
                        !url.searchParams.has('page'),
                );
                await waitFor(
                    async () => (await catalogIds())[0] === siblings[0].slug,
                    'Cheapest product was not first',
                );
                const prices = () =>
                    page
                        .locator('article p')
                        .allTextContents()
                        .then((texts) =>
                            texts
                                .map((s) => s.match(/EGP\s*([\d,.]+)/)?.[1])
                                .filter(Boolean)
                                .map((s) => Number(s.replaceAll(',', ''))),
                        );
                let values = await prices();
                assert.deepEqual(
                    values,
                    [...values].sort((a, b) => a - b),
                );
                await page
                    .getByRole('combobox', {name: 'Sort by', exact: true})
                    .selectOption('price-desc');
                await page.waitForURL(
                    (url) => url.searchParams.get('sort') === 'price-desc',
                );
                await waitFor(
                    async () =>
                        (await catalogIds())[0] === extraCatalog.at(-1).slug,
                    'Most expensive product was not first',
                );
                values = await prices();
                assert.deepEqual(
                    values,
                    [...values].sort((a, b) => b - a),
                );
            },
        );
        await t.test(
            'category, stock and multi-attribute filters intersect with search and remain available for empty results',
            async () => {
                await page.goto(origin + '/en/search');
                await page
                    .getByRole('combobox', {name: 'Category', exact: true})
                    .selectOption('z-robot-kits');
                await page.waitForURL(
                    (url) =>
                        url.searchParams.get('collection') === 'z-robot-kits',
                );
                await page.getByRole('checkbox', {name: /Alpha/}).check();
                await page.waitForURL((url) =>
                    url.searchParams
                        .getAll('facets')
                        .includes(brand.values[0].id),
                );
                await waitCatalog([siblings[0].slug, siblings[1].slug]);
                await page.getByRole('checkbox', {name: /Beta/}).check();
                await page.waitForURL(
                    (url) => url.searchParams.getAll('facets').length === 2,
                );
                await waitCatalog(siblings.slice(0, 4).map((p) => p.slug));
                await page.getByRole('checkbox', {name: /Starter/}).check();
                await page.waitForURL(
                    (url) => url.searchParams.getAll('facets').length === 3,
                );
                await waitCatalog([siblings[0].slug, siblings[2].slug]);
                await page
                    .getByRole('button', {name: 'Clear all', exact: true})
                    .click();
                await page.waitForURL(
                    (url) =>
                        !url.searchParams.has('facets') &&
                        !url.searchParams.has('collection'),
                );
                await page
                    .getByRole('combobox', {name: 'Category', exact: true})
                    .selectOption('z-robot-kits');
                await page.waitForURL(
                    (url) =>
                        url.searchParams.get('collection') === 'z-robot-kits',
                );
                await page
                    .getByRole('checkbox', {name: 'In stock only', exact: true})
                    .check();
                await page.waitForURL(
                    (url) => url.searchParams.get('stock') === '1',
                );
                await waitFor(async () => {
                    const ids = await catalogIds();
                    return ids.length === 5 && !ids.includes(siblings[4].slug);
                }, 'Sold-out product was not excluded');
                await page
                    .getByRole('searchbox', {
                        name: 'Search this catalog',
                        exact: true,
                    })
                    .fill('Unclassified');
                await page
                    .getByRole('button', {name: 'Search', exact: true})
                    .click();
                await page.waitForURL(
                    (url) => url.searchParams.get('q') === 'Unclassified',
                );
                await page
                    .getByText('No products found', {exact: true})
                    .waitFor();
                await page
                    .getByRole('combobox', {name: 'Sort by', exact: true})
                    .waitFor();
                await page
                    .getByRole('button', {name: 'Clear all', exact: true})
                    .click();
                await page.waitForURL(
                    (url) =>
                        url.searchParams.get('q') === 'Unclassified' &&
                        !url.searchParams.has('collection') &&
                        !url.searchParams.has('stock'),
                );
                await waitCatalog([loose.slug]);
                await page.screenshot({
                    path: path.join(artifacts, 'catalog-desktop-controls.png'),
                    fullPage: true,
                });
            },
        );
        await t.test(
            'mobile filters and sorting work on search and collection pages without overflow',
            async () => {
                await page.setViewportSize({width: 390, height: 844});
                await page.goto(origin + '/en/search');
                await page.getByRole('button', {name: /^Filters/}).click();
                await page
                    .getByRole('dialog')
                    .getByRole('combobox', {name: 'Category', exact: true})
                    .selectOption('z-robot-kits');
                await page.waitForURL(
                    (url) =>
                        url.searchParams.get('collection') === 'z-robot-kits',
                );
                await page
                    .getByRole('combobox', {name: 'Sort by', exact: true})
                    .selectOption('price-desc');
                await page.waitForURL(
                    (url) => url.searchParams.get('sort') === 'price-desc',
                );
                await waitFor(
                    async () => (await catalogIds()).length === 6,
                    'Mobile catalog did not load',
                );
                assert.ok(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                );
                await page.screenshot({
                    path: path.join(artifacts, 'catalog-mobile-controls.png'),
                    fullPage: true,
                });
                await page.goto(
                    origin + '/en/collection/z-robot-kits?sort=price-asc',
                );
                await waitFor(
                    async () => (await catalogIds())[0] === siblings[0].slug,
                    'Collection sorting failed',
                );
                await page
                    .getByRole('searchbox', {
                        name: 'Search this catalog',
                        exact: true,
                    })
                    .fill('Unclassified');
                await page
                    .getByRole('button', {name: 'Search', exact: true})
                    .click();
                await page
                    .getByText('No products found', {exact: true})
                    .waitFor();
                assert.deepEqual(errors, []);
            },
        );
        await t.test(
            'the section is empty when the source product is the only remaining visible product',
            async () => {
                for (const p of [
                    f.product,
                    ...siblings,
                    ...extraCatalog,
                    broad,
                    disabled,
                ])
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
