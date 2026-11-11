import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from '../../../node_modules/playwright/index.mjs';
import {waitFor} from './suite-fixture.mjs';

export async function growthBrowserSuite(
    t,
    f,
    {token, other, bundle, order, quote, returnId},
) {
    const root = path.resolve(process.cwd(), '..'),
        artifacts =
            process.env.SUITE_ARTIFACT_DIR ||
            path.join(f.root, 'growth-artifacts');
    await fs.mkdir(artifacts, {recursive: true});
    const env = {
        ...process.env,
        VENDURE_SHOP_API_URL: `http://localhost:${f.port}/shop-api`,
        VENDURE_CHANNEL_TOKEN: f.channelToken,
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_SHOW_STORE_POLICIES: 'false',
    };
    async function command(args, name, cwd = root) {
        const child = spawn('npm', args, {
            cwd,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let log = '';
        child.stdout.on('data', (b) => (log += b));
        child.stderr.on('data', (b) => (log += b));
        const [code] = await once(child, 'exit');
        await fs.writeFile(path.join(artifacts, name + '.log'), log);
        assert.equal(code, 0, log.slice(-10000));
    }
    let built = false;
    await t.test(
        'growth storefront and Dashboard production builds',
        async () => {
            await command(['run', 'build'], 'storefront-build');
            await command(
                ['run', 'dashboard:build'],
                'dashboard-build',
                process.cwd(),
            );
            built = true;
        },
    );
    if (!built) return;
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
    let logs = '';
    let browser;
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
        await fs.writeFile(
            path.join(artifacts, 'storefront-runtime.log'),
            logs,
        );
    });
    const origin = `http://127.0.0.1:${port}`;
    await waitFor(async () => {
        try {
            return (await fetch(origin + '/en')).ok;
        } catch {
            return false;
        }
    }, 'Built growth storefront failed to start');
    browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
        viewport: {width: 1440, height: 1000},
    });
    await context.addCookies([
        {name: 'vendure-auth-token', value: token, url: origin},
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(30000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shop = (q, v = {}) => f.query(q, v, {token});
    await t.test(
        'comparison uses saved product IDs and configured specifications; product help renders safe links',
        async () => {
            await page.goto(origin + '/en/search');
            const cards = page.locator('article');
            await cards.nth(1).waitFor();
            await cards
                .nth(0)
                .getByRole('button', {name: 'Add to comparison', exact: true})
                .click();
            await cards
                .nth(1)
                .getByRole('button', {name: 'Add to comparison', exact: true})
                .click();
            await page.goto(origin + '/en/compare');
            await page.getByText('Test Python', {exact: true}).waitFor();
            assert.equal(await page.locator('table thead th').count(), 3);
            await waitFor(
                () =>
                    page
                        .getByRole('img', {
                            name: 'Suite Test Robot',
                            exact: true,
                        })
                        .evaluate(
                            (img) => img.complete && img.naturalWidth > 0,
                        ),
                'Comparison robot image did not load',
            );
            await page.screenshot({
                path: path.join(artifacts, 'customer-comparison.png'),
                fullPage: true,
            });
            await page
                .getByRole('button', {name: 'Clear comparison', exact: true})
                .click();
            await page.goto(origin + '/en/product/suite-test-robot');
            await page
                .getByRole('heading', {
                    name: 'Specifications & help centre',
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('link', {name: /Test manual/})
                    .getAttribute('href'),
                'https://example.invalid/manual.pdf',
            );
            await page.getByText('Test question?', {exact: true}).click();
            await page.getByText('Test answer.', {exact: true}).waitFor();
        },
    );
    await t.test(
        'customer adds an actual bundle through the production server action',
        async () => {
            await page.goto(origin + '/en/bundles');
            await page
                .getByRole('heading', {name: bundle.name, exact: true})
                .waitFor();
            await page
                .getByRole('button', {name: 'Add complete bundle', exact: true})
                .click();
            await page
                .getByText('Bundle components added to your cart.', {
                    exact: true,
                })
                .waitFor();
            const cart = (
                await shop('{activeOrder{id totalWithTax lines{id quantity}}}')
            ).data.activeOrder;
            assert.equal(cart.totalWithTax, 12000);
            assert.equal(cart.lines.length, 2);
            await page.screenshot({
                path: path.join(artifacts, 'customer-bundle.png'),
                fullPage: true,
            });
        },
    );
    let uiQuoteId;
    await t.test(
        'school customer submits quantities and sees the saved request without a fabricated order',
        async () => {
            await page.goto(origin + '/en/school-quote');
            await page
                .getByRole('button', {name: 'SUITE-ROBOT +', exact: true})
                .click();
            await page
                .getByLabel('School / academy / organization', {exact: true})
                .fill('Browser Test School');
            await page
                .getByLabel('Contact phone', {exact: true})
                .fill('01012345678');
            await page
                .getByLabel('Additional details', {exact: true})
                .fill('Browser quotation request');
            await page
                .getByRole('button', {
                    name: 'Send quotation request',
                    exact: true,
                })
                .click();
            await page
                .getByText(
                    'Your quotation request was saved. You can follow it in your account.',
                    {exact: true},
                )
                .waitFor();
            const rows = (await shop('{mySchoolQuotes}')).data.mySchoolQuotes
                .items;
            const q = rows.find(
                (q) => q.organization === 'Browser Test School',
            );
            assert.equal(q.status, 'requested');
            assert.equal(q.orderId, null);
            uiQuoteId = q.id;
            await page.goto(origin + '/en/account/quotes');
            await page
                .getByRole('heading', {name: new RegExp('Browser Test School')})
                .waitFor();
            await page.screenshot({
                path: path.join(artifacts, 'customer-quotes.png'),
                fullPage: true,
            });
        },
    );
    let uiReturnId;
    await t.test(
        'delivered customer requests remaining return quantity and uploads a private photo',
        async () => {
            await page.goto(origin + '/en/account/orders/' + order.code);
            await page
                .getByRole('button', {
                    name: 'Request a return or exchange',
                    exact: true,
                })
                .click();
            const form = page.locator('form').filter({
                has: page.getByRole('button', {
                    name: 'Submit return request',
                    exact: true,
                }),
            });
            await form.locator('input[type=number]').first().fill('1');
            await form
                .getByLabel('Reason and item condition', {exact: true})
                .fill('Browser return request');
            await form
                .getByRole('button', {
                    name: 'Submit return request',
                    exact: true,
                })
                .click();
            await page
                .getByText(
                    'Your return request was saved. You can now add photos from your account.',
                    {exact: true},
                )
                .waitFor();
            const returns = (await shop('{myReturnRequests}')).data
                .myReturnRequests.items;
            const r = returns.find(
                (r) => r.reason === 'Browser return request',
            );
            assert.ok(r);
            uiReturnId = r.id;
            await page.goto(origin + '/en/account/returns');
            const card = page.getByRole('article').filter({
                has: page.getByRole('heading', {
                    name: 'Request #' + uiReturnId,
                    exact: true,
                }),
            });
            await card.waitFor();
            const png = await sharp({
                create: {
                    width: 120,
                    height: 80,
                    channels: 3,
                    background: '#edf8ff',
                },
            })
                .png()
                .toBuffer();
            await card
                .getByLabel('Add a supporting photo', {exact: true})
                .setInputFiles({
                    name: 'browser-return.png',
                    mimeType: 'image/png',
                    buffer: png,
                });
            await card
                .getByRole('button', {name: 'Upload photo', exact: true})
                .click();
            await page
                .getByText('Photo uploaded privately.', {exact: true})
                .waitFor();
            await page.screenshot({
                path: path.join(artifacts, 'customer-return.png'),
                fullPage: true,
            });
            const owner = (
                await shop('{myReturnRequests}')
            ).data.myReturnRequests.items.find(
                (r) => String(r.id) === String(uiReturnId),
            );
            assert.equal(owner.photoCount, 1);
            assert.equal(owner.internalNotes, undefined);
        },
    );
    await t.test(
        'stock opt-in and cart email consent are explicit and can be revoked from the account',
        async () => {
            const accessory = (
                await f.admin(
                    '{productVariants(options:{filter:{sku:{eq:"SUITE-ACCESSORY"}}}){items{id}}}',
                )
            ).data.productVariants.items[0];
            await f.admin(
                'mutation($input:[UpdateProductVariantInput!]!){updateProductVariants(input:$input){id}}',
                {
                    input: [
                        {
                            id: accessory.id,
                            stockLevels: [
                                {
                                    stockLocationId: f.location.id,
                                    stockOnHand: 0,
                                },
                            ],
                        },
                    ],
                },
            );
            await page.goto(origin + '/en/product/suite-accessory');
            await page
                .getByRole('button', {
                    name: 'Email me when available',
                    exact: true,
                })
                .click();
            await page
                .getByRole('button', {name: 'Stop this alert', exact: true})
                .waitFor();
            await page.goto(origin + '/en/account/notifications');
            await page.getByText('Suite Accessory', {exact: true}).waitFor();
            const consent = page.getByRole('checkbox', {
                name: 'Yes, email me a reminder if I leave a cart unfinished.',
                exact: true,
            });
            assert.equal(await consent.isChecked(), false);
            await consent.check();
            await page
                .getByText('Email preference saved.', {exact: true})
                .waitFor();
            assert.equal(
                (await shop('{myShopMailPreference}')).data.myShopMailPreference
                    .cartReminderConsent,
                true,
            );
            await consent.uncheck();
            await page
                .getByText('Email preference saved.', {exact: true})
                .waitFor();
            assert.equal(
                (await shop('{myShopMailPreference}')).data.myShopMailPreference
                    .cartReminderConsent,
                false,
            );
            await page.screenshot({
                path: path.join(
                    artifacts,
                    'customer-notification-preferences.png',
                ),
                fullPage: true,
            });
            await page
                .getByRole('button', {name: 'Stop this alert', exact: true})
                .click();
            await page
                .getByText(
                    'You have no active stock alerts. You can request one on an unavailable product variant.',
                    {exact: true},
                )
                .waitFor();
        },
    );
    await t.test(
        'native Dashboard catalog and customer-care screens load real scoped data',
        async () => {
            const admin = await browser.newPage({
                viewport: {width: 1500, height: 1000},
            });
            admin.setDefaultTimeout(15000);
            await admin.goto(`http://127.0.0.1:${f.port}/dashboard/`);
            await admin
                .locator('#field-username')
                .fill(f.env.SUPERADMIN_USERNAME);
            await admin
                .locator('#field-password')
                .fill(f.env.SUPERADMIN_PASSWORD);
            await admin.getByRole('button', {name: /Log in|Sign in/i}).click();
            await admin.waitForURL((url) => !url.pathname.includes('login'));
            await admin.goto(
                `http://127.0.0.1:${f.port}/dashboard/shop-catalog-tools`,
            );
            await admin
                .getByRole('heading', {
                    name: 'Catalog tools / أدوات المنتجات',
                    exact: true,
                })
                .waitFor();
            const channel = admin
                .getByRole('button')
                .filter({hasText: /Default channel/})
                .first();
            if (await channel.count()) {
                await channel.click();
                await admin
                    .getByText('skillverse-eg', {exact: true})
                    .last()
                    .click();
            }
            await admin.getByText(bundle.name, {exact: true}).waitFor();
            await admin
                .getByRole('combobox', {name: 'Product', exact: true})
                .selectOption(f.product.id);
            await admin
                .getByText(
                    'Suite Test Robot — comparison & help / المقارنة والمساعدة',
                    {exact: true},
                )
                .waitFor();
            await admin
                .getByRole('textbox', {
                    name: 'Programming / البرمجة',
                    exact: true,
                })
                .fill('Browser Python specification');
            await admin
                .getByRole('button', {
                    name: 'Save product content / حفظ البيانات',
                    exact: true,
                })
                .click();
            await admin
                .getByText('Product content saved / تم حفظ بيانات المنتج', {
                    exact: true,
                })
                .waitFor();
            await admin.screenshot({
                path: path.join(artifacts, 'admin-catalog-tools.png'),
                fullPage: true,
            });
            await admin.goto(
                `http://127.0.0.1:${f.port}/dashboard/shop-customer-care`,
            );
            await admin
                .getByRole('heading', {
                    name: 'Customer care / خدمة العملاء',
                    exact: true,
                })
                .waitFor();
            const quoteRow = admin
                .getByRole('row')
                .filter({hasText: 'Browser Test School'});
            await quoteRow
                .getByRole('button', {name: 'Open / فتح', exact: true})
                .click();
            await admin
                .getByLabel('Agreed delivery (EGP)', {exact: true})
                .fill('115');
            await admin
                .getByRole('button', {
                    name: 'Publish offer / إرسال العرض',
                    exact: true,
                })
                .click();
            await admin
                .getByText('Offer published / تم إرسال العرض', {exact: true})
                .waitFor();
            await admin
                .getByRole('button', {name: 'Returns / المرتجعات', exact: true})
                .click();
            const returnRow = admin.getByRole('row').filter({
                has: admin.getByRole('cell', {
                    name: '#' + uiReturnId,
                    exact: true,
                }),
            });
            await returnRow
                .getByRole('button', {name: 'Open / فتح', exact: true})
                .click();
            await admin
                .getByRole('button', {name: 'Private photo 1', exact: true})
                .click();
            await admin
                .getByAltText('Private return photo', {exact: true})
                .waitFor();
            await admin.screenshot({
                path: path.join(artifacts, 'admin-return-review.png'),
                fullPage: true,
            });
            await admin.close();
            await page.bringToFront();
            await page.goto(origin + '/en/account/quotes');
            const q = page.getByRole('article').filter({
                has: page.getByRole('heading', {
                    name: 'Browser Test School · #' + uiQuoteId,
                    exact: true,
                }),
            });
            await q
                .getByRole('button', {name: 'Accept this offer', exact: true})
                .click();
            await page
                .getByText(
                    'Offer accepted. Our team will contact you to finalize the order.',
                    {exact: true},
                )
                .waitFor();
        },
    );
    await t.test(
        'new commerce controls remain usable on a mobile viewport',
        async () => {
            await page.setViewportSize({width: 390, height: 844});
            await page.goto(origin + '/en/bundles');
            await page
                .getByRole('heading', {name: 'Product bundles', exact: true})
                .waitFor();
            assert.ok(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            );
            await page.goto(origin + '/en/account/quotes');
            await page
                .getByRole('heading', {name: 'My quotations', exact: true})
                .waitFor();
            await page
                .getByRole('heading', {name: new RegExp('Browser Test School')})
                .waitFor();
            assert.ok(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            );
            await page.screenshot({
                path: path.join(artifacts, 'mobile-quotations.png'),
                fullPage: true,
            });
            assert.deepEqual(errors, [], 'no customer-side JavaScript errors');
        },
    );
}
