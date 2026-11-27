import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../../../node_modules/playwright/index.mjs';
export async function marketplaceBrowserSuite(t, f, { orderId }) {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const artifacts = process.env.SUITE_ARTIFACT_DIR || f.root;
    await fs.mkdir(artifacts, { recursive: true });
    t.after(() => browser.close());
    async function login(email, openProducts = true, password = 'synthetic-admin-password') {
        const page = await browser.newPage({
            viewport: { width: 1500, height: 1000 },
        });
        page.on('pageerror', (e) =>
            console.error('Dashboard browser error:', e.message),
        );
        await page.goto(`http://127.0.0.1:${f.port}/dashboard/`);
        await page.locator('#field-username').fill(email);
        await page.locator('#field-password').fill(password);
        await page.getByRole('button', { name: /Log in|Sign in/i }).click();
        await page.waitForURL((url) => !url.pathname.includes('login'));
        await page.goto(`http://127.0.0.1:${f.port}/dashboard/shop-operations`);
        await page
            .getByRole('heading', { name: 'Shop operations / إدارة المتجر' })
            .waitFor();
        if (openProducts) {
            await page
                .getByRole('tab', { name: 'Products / المنتجات', exact: true })
                .click();
            await page
                .getByRole('button', { name: 'Add product / إضافة منتج' })
                .waitFor();
        }
        return page;
    }
    async function assertSingleNavigation(page) {
        // Expand sections first so a collapsed menu cannot make this pass.
        for (const name of ['Catalog', 'Sales', 'Settings']) {
            const section = page.getByRole('button', { name, exact: true });
            if (await section.count() && await section.getAttribute('aria-expanded') !== 'true') {
                await section.click();
            }
        }
        for (const path of ['orders', 'products', 'product-variants', 'payment-methods']) {
            assert.equal(await page.locator(`a[href="/dashboard/${path}"]`).count(), 0,
                `Duplicate native ${path} menu must be absent`);
        }
        assert.equal(await page.getByRole('link', {
            name: 'Shop operations / إدارة المتجر', exact: true,
        }).count(), 1);
    }
    await t.test('SuperAdmin uses one commerce entry with working Products, Orders and Payments tabs', async () => {
        const page = await login(f.env.SUPERADMIN_USERNAME, false, f.env.SUPERADMIN_PASSWORD);
        const channel = page.getByRole('button').filter({ hasText: /Default channel/ }).first();
        await channel.click();
        await page.getByText('skillverse-eg', { exact: true }).last().click();
        await page.getByRole('tab', { name: 'Products / المنتجات', exact: true }).click();
        await page.getByRole('cell', { name: 'vendor-a-robot', exact: true }).first().waitFor();
        await assertSingleNavigation(page);
        await page.getByRole('row').filter({ hasText: 'vendor-a-robot' })
            .getByRole('button', { name: 'Edit / تعديل', exact: true }).click();
        await page.getByRole('link', { name: 'Advanced product options / خيارات المنتج المتقدمة', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Payments / الدفع', exact: true }).click();
        await page.getByRole('heading', { name: 'Cash on Delivery', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Orders / الطلبات', exact: true }).click();
        const source = (await f.admin('query($id:ID!){order(id:$id){code}}', { id: orderId })).data.order;
        await page.getByRole('row').filter({ hasText: source.code })
            .getByRole('button', { name: 'Open / فتح', exact: true }).click();
        await page.getByRole('heading', { name: 'Order items & shipping / بنود الطلب والشحن', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Advanced order details / تفاصيل الطلب المتقدمة', exact: true }).waitFor();
        await page.screenshot({ path: path.join(artifacts, 'superadmin-single-commerce-navigation.png'), fullPage: true });
        await page.getByRole('button').filter({ hasText: /skillverse-eg/ }).first().click();
        await page.getByText('Default channel', { exact: true }).last().click();
        for (const name of ['Catalog', 'Settings']) {
            const section = page.getByRole('button', { name, exact: true });
            if (await section.getAttribute('aria-expanded') !== 'true') await section.click();
        }
        await page.locator('a[href="/dashboard/products"]').waitFor();
        await page.locator('a[href="/dashboard/payment-methods"]').waitFor();
        await page.close();
    });
    await t.test(
        'production Dashboard seller sees only owned catalog and can add a stocked product',
        async () => {
            const page = await login('vendor-b@example.invalid');
            await assertSingleNavigation(page);
            assert.equal(
                await page.getByRole('heading', { level: 1 }).count(),
                1,
            );
            assert.equal(await page.getByRole('tablist').count(), 1);
            assert.equal(
                await page.getByText('Store / المتجر', { exact: true }).count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('link', { name: /Selling workspace/ })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('link', {
                        name: 'Shop operations / إدارة المتجر',
                        exact: true,
                    })
                    .count(),
                1,
            );
            await page.getByText('vendor-b-robot', { exact: true }).waitFor();
            assert.equal(
                await page.getByText('vendor-a-robot', { exact: true }).count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Team & sellers / الحسابات والبائعون',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('link', { name: 'Global Settings', exact: true })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('link', { name: 'Roles', exact: true })
                    .count(),
                0,
            );
            await page
                .getByRole('button', { name: 'Add product / إضافة منتج' })
                .click();
            const form = page.getByRole('form', { name: 'Product editor' });
            await form
                .getByLabel('Name (English)', { exact: true })
                .fill('Browser Seller Robot');
            const slug = form.getByLabel('URL slug', { exact: true });
            assert.equal(await slug.inputValue(), 'browser-seller-robot');
            await slug.fill('custom-robot-kit');
            const productName = form.getByLabel('Name (English)', { exact: true });
            await productName.fill('Browser Seller Robot Kit');
            assert.equal(await slug.inputValue(), 'custom-robot-kit');
            await productName.fill('Browser Seller Robot');
            const details = form.getByRole('textbox', { name: 'Details (English)', exact: true });
            await details.fill('Included accessories');
            await details.press('ControlOrMeta+a');
            await form.getByRole('button', { name: 'Bold / عريض' }).first().click();
            assert.equal(await details.locator('strong').innerText(), 'Included accessories');
            await details.press('ArrowRight');
            await details.press('Enter');
            await form.getByRole('button', { name: 'Bullets / نقاط' }).first().click();
            await page.keyboard.type('USB cable');
            assert.equal(await details.locator('li').innerText(), 'USB cable');
            const remove = form.getByRole('button', { name: 'Remove variant / حذف الإصدار' });
            assert.ok(await remove.first().isDisabled());
            await form.getByRole('button', { name: 'Add variant / إضافة إصدار' }).click();
            for (const width of [1500, 390]) {
                await page.setViewportSize({ width, height: 1000 });
                const checkbox = form.getByRole('checkbox', { name: 'Available / متاح' }).nth(1);
                await remove.nth(1).scrollIntoViewIfNeeded();
                const box = await checkbox.boundingBox();
                const button = await remove.nth(1).boundingBox();
                assert.ok(box && button && button.y >= box.y + box.height,
                    `Remove must be below Available at ${width}px: ${JSON.stringify({ box, button })}`);
                assert.ok(Math.abs(button.x - box.x) < 10);
                assert.ok(button.width < 145 && button.height <= 36,
                    `Expected a compact remove button at ${width}px: ${JSON.stringify(button)}`);
            }
            await page.setViewportSize({ width: 1500, height: 1000 });
            await remove.nth(1).click();
            assert.equal(await remove.count(), 1);
            await form
                .getByLabel('Variant name / اسم الإصدار', { exact: true })
                .fill('Browser robot');
            await form
                .getByLabel('SKU', { exact: true })
                .fill('BROWSER-SELLER-SKU');
            await form
                .getByLabel('Price (EGP) / السعر بالجنيه', { exact: true })
                .fill('145');
            await form.getByLabel('Stock / الكمية', { exact: true }).fill('7');
            await form
                .getByRole('button', { name: 'Save product / حفظ المنتج' })
                .click();
            await page
                .getByRole('status')
                .filter({ hasText: 'Saved / تم الحفظ' })
                .waitFor();
            await page
                .getByRole('cell', {
                    name: 'Browser Seller Robot',
                    exact: true,
                })
                .waitFor();
            await page.getByRole('row').filter({hasText: 'Browser Seller Robot'})
                .getByRole('button', {name: 'Edit / تعديل'}).click();
            await form.getByRole('textbox', {name: 'Details (English)'}).locator('li').waitFor();
            assert.equal(await details.locator('strong').first().innerText(), 'Included accessories');
            assert.equal(await details.locator('li').innerText(), 'USB cable');
            assert.equal(await slug.inputValue(), 'custom-robot-kit');
            await page
                .getByRole('tab', {
                    name: 'Delivery rates / أسعار التوصيل',
                    exact: true,
                })
                .click();
            await page
                .getByRole('cell', {
                    name: 'Synthetic vendor-b delivery',
                    exact: true,
                })
                .waitFor();
            await page
                .getByRole('tab', { name: 'Orders / الطلبات', exact: true })
                .click();
            const source = (
                await f.admin('query($id:ID!){order(id:$id){code}}', {
                    id: orderId,
                })
            ).data.order;
            await page
                .getByRole('row')
                .filter({ hasText: source.code })
                .getByRole('button', {
                    name: 'View items / عرض البنود',
                    exact: true,
                })
                .click();
            await page
                .getByRole('cell', { name: 'vendor-b-robot', exact: true })
                .first()
                .waitFor();
            assert.equal(
                await page
                    .getByRole('cell', { name: 'vendor-a-robot', exact: true })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', { name: 'Payments / الدفع', exact: true })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings / الإعدادات',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('button', {
                        name: 'Create pending refund / تسجيل استرداد معلق',
                        exact: true,
                    })
                    .count(),
                0,
            );
            await page.screenshot({
                path: path.join(artifacts, 'seller-workspace.png'),
                fullPage: true,
            });
            await page.close();
        },
    );
    await t.test(
        'production store admin sees all sellers and operations without system settings',
        async () => {
            const page = await login('store-admin@example.invalid');
            await assertSingleNavigation(page);
            await page
                .getByRole('cell', { name: 'vendor-a-robot', exact: true })
                .first()
                .waitFor();
            await page
                .getByRole('cell', { name: 'vendor-b-robot', exact: true })
                .first()
                .waitFor();
            assert.equal(
                await page
                    .getByRole('link', { name: 'Global Settings', exact: true })
                    .count(),
                0,
            );
            await page
                .getByRole('tab', {
                    name: 'Team & sellers / الحسابات والبائعون',
                    exact: true,
                })
                .click();
            await page
                .getByRole('heading', { name: 'Create account / إنشاء حساب' })
                .waitFor();
            await page
                .getByRole('tab', { name: 'Payments / الدفع', exact: true })
                .click();
            await page
                .getByRole('heading', { name: 'Cash on Delivery', exact: true })
                .waitFor();
            await page.goto(
                `http://127.0.0.1:${f.port}/dashboard/shop-operations`,
            );
            await page
                .getByRole('heading', {
                    name: 'Shop operations / إدارة المتجر',
                    exact: true,
                })
                .waitFor();
            await page
                .getByRole('tab', { name: 'Orders / الطلبات', exact: true })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings / الإعدادات',
                        exact: true,
                    })
                    .count(),
                0,
            );
            const source = (
                await f.admin('query($id:ID!){order(id:$id){code}}', {
                    id: orderId,
                })
            ).data.order;
            await page
                .getByRole('row')
                .filter({ hasText: source.code })
                .getByRole('button', { name: 'Open / فتح', exact: true })
                .click();
            await page
                .getByRole('heading', {
                    name: 'Order items & shipping / بنود الطلب والشحن',
                    exact: true,
                })
                .waitFor();
            await page
                .getByRole('cell', { name: 'vendor-a-robot', exact: true })
                .first()
                .waitFor();
            await page
                .getByRole('cell', { name: 'vendor-b-robot', exact: true })
                .first()
                .waitFor();
            assert.equal(
                await page
                    .getByRole('button', {
                        name: 'Create pending refund / تسجيل استرداد معلق',
                        exact: true,
                    })
                    .count(),
                1,
            );
            assert.equal(
                await page
                    .getByRole('link', { name: /Order items, shipments/ })
                    .count(),
                0,
            );
            assert.equal(
                await page.getByText('Store / المتجر', { exact: true }).count(),
                0,
            );
            await page.screenshot({
                path: path.join(artifacts, 'store-admin-operations.png'),
                fullPage: true,
            });
            await page
                .getByRole('heading', {
                    name: 'Order items & shipping / بنود الطلب والشحن',
                    exact: true,
                })
                .scrollIntoViewIfNeeded();
            await page.screenshot({
                path: path.join(artifacts, 'store-admin-embedded-shipping.png'),
                fullPage: true,
            });
            await page.goto(
                `http://127.0.0.1:${f.port}/dashboard/store-workspace`,
            );
            await page.waitForURL(
                (url) =>
                    url.pathname.endsWith('/shop-operations') &&
                    url.searchParams.get('tab') === 'products',
            );
            await page
                .getByRole('button', {
                    name: 'Add product / إضافة منتج',
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Products / المنتجات',
                        exact: true,
                    })
                    .getAttribute('aria-selected'),
                'true',
            );
            await page.goto(
                `http://127.0.0.1:${f.port}/dashboard/store-workspace/?tab=accounts`,
            );
            await page.waitForURL(
                (url) =>
                    url.pathname.endsWith('/shop-operations') &&
                    url.searchParams.get('tab') === 'accounts',
            );
            await page
                .getByRole('heading', {
                    name: 'Create account / إنشاء حساب',
                    exact: true,
                })
                .waitFor();
            await page.close();
        },
    );
    await t.test(
        'existing read-only sales staff keep their original order view',
        async () => {
            const role = (
                await f.admin(
                    'mutation($input:CreateRoleInput!){createRole(input:$input){id}}',
                    {
                        input: {
                            code: 'sales-readonly-fixture',
                            description: 'Synthetic existing sales reader',
                            permissions: ['ReadOrder'],
                            channelIds: [f.channel.id],
                        },
                    },
                )
            ).data.createRole;
            await f.admin(
                'mutation($input:CreateAdministratorInput!){createAdministrator(input:$input){id}}',
                {
                    input: {
                        firstName: 'Synthetic sales reader',
                        lastName: '',
                        emailAddress: 'sales-reader@example.invalid',
                        password: 'synthetic-admin-password',
                        roleIds: [role.id],
                    },
                },
            );
            const page = await login('sales-reader@example.invalid', false);
            assert.equal(await page.locator('a[href="/dashboard/orders"]').count(), 0);
            const source = (
                await f.admin('query($id:ID!){order(id:$id){code}}', {
                    id: orderId,
                })
            ).data.order;
            await page
                .getByRole('row')
                .filter({ hasText: source.code })
                .getByRole('button', { name: 'Open / فتح', exact: true })
                .click();
            await page
                .getByRole('button', {
                    name: 'Download PDF / تحميل PDF',
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('heading', {
                        name: 'Order items & shipping / بنود الطلب والشحن',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Products / المنتجات',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings / الإعدادات',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(await page.getByRole('alert').count(), 0);
            await page.close();
        },
    );
}
