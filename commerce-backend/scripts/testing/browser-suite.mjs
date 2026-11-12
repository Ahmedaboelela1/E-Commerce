import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {chromium} from '../../../node_modules/playwright/index.mjs';
import {waitFor} from './suite-fixture.mjs';

export async function browserSuite(
    t,
    f,
    {token, other, cod, bank, pendingBank},
) {
    const root = path.resolve(process.cwd(), '..');
    const artifacts =
        process.env.SUITE_ARTIFACT_DIR || path.join(f.root, 'artifacts');
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
        assert.equal(code, 0, `${name} failed:\n${log.slice(-10000)}`);
    }
    let built = false;
    await t.test('both complete production builds succeed', async () => {
        await command(['run', 'build'], 'storefront-build');
        await command(
            ['run', 'dashboard:build'],
            'dashboard-build',
            process.cwd(),
        );
        built = true;
    });
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
    next.stdout.on('data', (b) => (logs += b));
    next.stderr.on('data', (b) => (logs += b));
    let browser;
    t.after(async () => {
        await browser?.close();
        if (next.exitCode === null) {
            next.kill('SIGTERM');
            const timer=setTimeout(()=>next.kill('SIGKILL'),5000);
            await once(next, 'exit');
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
    }, 'Built Next server did not start');
    browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const {arabicPaymentBrowserSuite}=await import('./arabic-payment-browser-suite.mjs');
    await arabicPaymentBrowserSuite(t,f,browser,origin,artifacts);
    const context = await browser.newContext({
        viewport: {width: 1440, height: 1000},
    });
    await context.addCookies([
        {name: 'vendure-auth-token', value: token, url: origin},
    ]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await t.test(
        'customer can open account wishlist, reviews and PDF follow-up on built storefront',
        async () => {
            await page.goto(origin + '/en/account/wishlist');
            await page
                .getByRole('heading', {name: 'Wishlist', exact: true})
                .waitFor();
            await page
                .getByRole('heading', {name: 'Suite Test Robot', exact: true})
                .waitFor();
            await page.screenshot({
                path: path.join(artifacts, 'customer-wishlist.png'),
                fullPage: true,
            });
            await page.goto(origin + '/en/product/suite-test-robot');
            await page
                .getByRole('article')
                .getByText('Edited verified review', {exact: true})
                .waitFor();
            await page
                .getByRole('button', {
                    name: 'Remove from wishlist',
                    exact: true,
                })
                .waitFor();
            await page.screenshot({
                path: path.join(artifacts, 'product-reviews.png'),
                fullPage: true,
            });
            await page.goto(origin + '/en/account/orders/' + cod.code);
            await page
                .getByRole('button', {
                    name: 'Download invoice PDF',
                    exact: true,
                })
                .waitFor();
            await page.getByText('SUITE123', {exact: false}).waitFor();
            const download = page.waitForEvent('download');
            await page
                .getByRole('button', {
                    name: 'Download invoice PDF',
                    exact: true,
                })
                .click();
            const file = await download;
            assert.match(file.suggestedFilename(), /\.pdf$/);
            await page.screenshot({
                path: path.join(artifacts, 'customer-order-followup.png'),
                fullPage: true,
            });
            assert.deepEqual(errors, [], 'no browser JavaScript errors');
            const unauthorized = await browser.newContext();
            await unauthorized.addCookies([
                {name: 'vendure-auth-token', value: other, url: origin},
            ]);
            const bad = await unauthorized.request.get(
                origin + '/api/commerce/order?orderId=' + bank.id,
            );
            assert.notEqual(bad.status(), 200);
            await unauthorized.close();
        },
    );
    await t.test(
        'customer server actions persist wishlist changes and upload proof without collecting payment',
        async () => {
            await page.goto(origin + '/en/account/wishlist');
            await page
                .getByRole('button', {
                    name: 'Remove from wishlist',
                    exact: true,
                })
                .click();
            await page
                .getByText(
                    'Your wishlist is empty. Save products to find them here.',
                    {exact: true},
                )
                .waitFor();
            await page.goto(origin + '/en/product/suite-test-robot');
            await page
                .getByRole('button', {name: 'Save to wishlist', exact: true})
                .click();
            await page
                .getByRole('button', {
                    name: 'Remove from wishlist',
                    exact: true,
                })
                .waitFor();
            await page.goto(origin + '/en/account/orders/' + pendingBank.code);
            await page
                .getByLabel('Transfer reference', {exact: true})
                .fill('BROWSER-REF-TEST');
            const png = await sharp({
                create: {
                    width: 120,
                    height: 70,
                    channels: 3,
                    background: '#edf8ff',
                },
            })
                .png()
                .toBuffer();
            await page
                .getByLabel('Receipt image (optional)', {exact: true})
                .setInputFiles({
                    name: 'browser-receipt.png',
                    mimeType: 'image/png',
                    buffer: png,
                });
            await page
                .getByRole('button', {name: 'Submit for review', exact: true})
                .click();
            await page
                .getByText('Transfer details submitted for review.', {
                    exact: true,
                })
                .waitFor();
            const order = (
                await f.admin(
                    'query($id:ID!){shopOperationsOrder(orderId:$id)}',
                    {id: pendingBank.id},
                )
            ).data.shopOperationsOrder;
            assert.equal(order.receiptStatus, 'pending');
            assert.equal(order.receiptUploaded, true);
            assert.equal(order.payments[0].state, 'Authorized');
            await page.screenshot({
                path: path.join(artifacts, 'customer-transfer-proof.png'),
                fullPage: true,
            });
        },
    );
    await t.test('new customer controls fit a mobile viewport', async () => {
        await page.setViewportSize({width: 390, height: 844});
        await page.goto(origin + '/en/account/wishlist');
        await page
            .getByRole('heading', {name: 'Wishlist', exact: true})
            .waitFor();
        await page
            .getByRole('button', {name: 'Remove from wishlist', exact: true})
            .waitFor();
        await page.screenshot({
            path: path.join(artifacts, 'mobile-wishlist.png'),
            fullPage: true,
        });
        assert.ok(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
            'new navigation must not force horizontal scrolling',
        );
    });
    if (process.env.SUITE_DESIGN === 'true')
        await t.test(
            'catalog hearts, guest redirect and accessible image gallery',
            async () => {
                await page.bringToFront();
                await page.setViewportSize({width: 1440, height: 1000});
                await page.goto(origin + '/en');
                await page
                    .getByRole('heading', {name: /Big ideas start/})
                    .waitFor();
                const card = page.locator('#products article').first();
                const heart = card.getByRole('button', {
                    name: 'Remove from wishlist',
                    exact: true,
                });
                await heart.waitFor();
                await heart.click();
                await card
                    .getByRole('button', {
                        name: 'Save to wishlist',
                        exact: true,
                    })
                    .waitFor();
                assert.equal(new URL(page.url()).pathname, '/en');
                await card
                    .getByRole('button', {
                        name: 'Save to wishlist',
                        exact: true,
                    })
                    .click();
                await heart.waitFor();
                await page.screenshot({
                    path: path.join(artifacts, 'redesigned-home-desktop.png'),
                    fullPage: true,
                });
                await page.goto(origin + '/en/product/suite-test-robot');
                await page
                    .getByRole('button', {name: 'Next image', exact: true})
                    .click();
                await page
                    .getByRole('button', {name: 'Show image 2', exact: true})
                    .waitFor();
                assert.equal(
                    await page
                        .getByRole('button', {
                            name: 'Show image 2',
                            exact: true,
                        })
                        .getAttribute('aria-pressed'),
                    'true',
                );
                await page.screenshot({
                    path: path.join(
                        artifacts,
                        'redesigned-product-desktop.png',
                    ),
                    fullPage: true,
                });
                await page.setViewportSize({width: 390, height: 844});
                await page.goto(origin + '/en/search');
                await page.locator('article').first().waitFor();
                assert.ok(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <= innerWidth,
                    ),
                );
                await page.screenshot({
                    path: path.join(artifacts, 'redesigned-catalog-mobile.png'),
                    fullPage: true,
                });
                const guest = await browser.newContext({
                    viewport: {width: 390, height: 844},
                });
                const guestPage = await guest.newPage();
                await Promise.all([
                    guestPage.waitForResponse((r) =>
                        r.url().includes('/api/commerce/account'),
                    ),
                    guestPage.goto(origin + '/en/search'),
                ]);
                await guestPage
                    .locator('article')
                    .first()
                    .getByRole('button', {
                        name: 'Save to wishlist',
                        exact: true,
                    })
                    .click();
                await guestPage.waitForURL(/sign-in/);
                await guest.close();
            },
        );
    await t.test(
        'dashboard extension renders all operations tabs and native channel data',
        async () => {
            const adminPage = await browser.newPage({
                viewport: {width: 1500, height: 1000},
            });
            await adminPage.goto(`http://127.0.0.1:${f.port}/dashboard/`);
            await adminPage
                .locator('#field-username')
                .fill(f.env.SUPERADMIN_USERNAME);
            await adminPage
                .locator('#field-password')
                .fill(f.env.SUPERADMIN_PASSWORD);
            await adminPage
                .getByRole('button', {name: /Log in|Sign in/i})
                .click();
            await adminPage.waitForURL(
                (url) => !url.pathname.includes('login'),
            );
            await adminPage.goto(
                `http://127.0.0.1:${f.port}/dashboard/shop-operations`,
            );
            await adminPage
                .getByRole('heading', {
                    name: 'Shop operations / إدارة المتجر',
                    exact: true,
                })
                .waitFor();
            // The synthetic super-admin initially opens its default channel; select Egypt through the native chooser.
            const channelButton = adminPage
                .getByRole('button')
                .filter({hasText: /Default channel/})
                .first();
            if (await channelButton.count()) {
                await channelButton.click();
                await adminPage
                    .getByText('skillverse-eg', {exact: true})
                    .last()
                    .click();
            }
            await adminPage
                .getByRole('tab', {name: 'Orders / الطلبات', exact: true})
                .click();
            await adminPage.getByText(cod.code, {exact: true}).waitFor();
            await adminPage
                .getByRole('row')
                .filter({hasText: cod.code})
                .getByRole('button', {name: 'Open / فتح', exact: true})
                .click();
            await adminPage
                .getByText('Private telephone confirmation', {exact: false})
                .waitFor();
            await adminPage.screenshot({
                path: path.join(artifacts, 'admin-order-operations.png'),
                fullPage: true,
            });
            for (const tab of [
                'Sales / المبيعات',
                'Stock / المخزون',
                'Reviews / التقييمات',
                'Coupons / الكوبونات',
                'Settings / الإعدادات',
            ])
                await adminPage
                    .getByRole('tab', {name: tab, exact: true})
                    .click();
            await adminPage
                .getByText('Invoice seller / بيانات البائع', {exact: true})
                .waitFor();
            await adminPage.screenshot({
                path: path.join(artifacts, 'admin-merchant-settings.png'),
                fullPage: true,
            });
            await adminPage.close();
        },
    );
}
