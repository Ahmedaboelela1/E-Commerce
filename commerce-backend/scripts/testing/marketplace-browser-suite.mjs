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
            .getByRole('heading', { name: 'Shop operations' })
            .waitFor();
        if (openProducts) {
            await page
                .getByRole('tab', { name: 'Products', exact: true })
                .click();
            await page
                .getByRole('button', { name: 'Add product' })
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
            name: 'Shop operations', exact: true,
        }).count(), 1);
    }
    await t.test('SuperAdmin uses one commerce entry with working Products, Orders and Payments tabs', async () => {
        const page = await login(f.env.SUPERADMIN_USERNAME, false, f.env.SUPERADMIN_PASSWORD);
        const channel = page.getByRole('button').filter({ hasText: /Default channel/ }).first();
        await channel.click();
        await page.getByText('skillverse-eg', { exact: true }).last().click();
        await page.getByRole('tab', { name: 'Products', exact: true }).click();
        await page.getByRole('cell', { name: 'vendor-a-robot', exact: true }).first().waitFor();
        await assertSingleNavigation(page);
        await page.getByRole('row').filter({ hasText: 'vendor-a-robot' })
            .getByRole('button', { name: 'Edit', exact: true }).click();
        await page.getByRole('link', { name: 'Advanced product options', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Payments', exact: true }).click();
        await page.getByRole('heading', { name: 'Cash on Delivery', exact: true }).waitFor();
        await page.getByRole('tab', { name: 'Orders', exact: true }).click();
        const source = (await f.admin('query($id:ID!){order(id:$id){code}}', { id: orderId })).data.order;
        const open = page.getByRole('row').filter({ hasText: source.code })
            .getByRole('button', { name: 'Open', exact: true });
        await open.click();
        const dialog = page.getByRole('dialog', { name: new RegExp(source.code) });
        await dialog.getByRole('heading', { name: 'Order items & shipping', exact: true }).waitFor();
        await dialog.getByRole('link', { name: 'Advanced order details', exact: true }).waitFor();
        await page.screenshot({ path: path.join(artifacts, 'superadmin-single-commerce-navigation.png'), fullPage: true });

        await page.setViewportSize({ width: 390, height: 750 });
        const bounds = await dialog.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
        const invoice = dialog.getByRole('button', { name: 'Download PDF', exact: true });
        await invoice.scrollIntoViewIfNeeded();
        assert.ok(await dialog.evaluate(element => element.scrollTop > 0));
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await open.and(page.locator(':focus')).waitFor({timeout: 5000});
        assert.equal(new URL(page.url()).searchParams.get('tab'), 'orders');
        await page.setViewportSize({ width: 1500, height: 1000 });
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
                        name: 'Shop operations',
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
                        name: 'Team & sellers',
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
            const add = page.getByRole('button', { name: 'Add product', exact: true });
            const search = page.getByRole('textbox', { name: 'Search', exact: true });
            const [addBox, searchBox] = await Promise.all([add.boundingBox(), search.boundingBox()]);
            assert.ok(addBox && searchBox && Math.abs(addBox.y + addBox.height - searchBox.y - searchBox.height) < 2);
            const dialog = page.getByRole('dialog', { name: 'New product' });
            assert.equal(await dialog.count(), 0);
            await add.click();
            const draftName = dialog.getByLabel('Name (English)', { exact: true });
            await draftName.fill('Abandoned draft');
            await page.keyboard.press('Escape');
            await dialog.waitFor({ state: 'hidden' });
            assert.equal(await add.evaluate(button => button === document.activeElement), true);
            await add.click();
            assert.equal(await draftName.inputValue(), '');
            await draftName.fill('Browser Seller Robot');
            const form = page.getByRole('form', { name: 'Product editor' });
            const slug = form.getByLabel('URL slug', { exact: true });
            assert.equal(await slug.inputValue(), 'browser-seller-robot');
            await slug.fill('custom-robot-kit');
            const productName = form.getByLabel('Name (English)', { exact: true });
            await productName.fill('Browser Seller Robot Kit');
            assert.equal(await slug.inputValue(), 'custom-robot-kit');
            await productName.fill('Browser Seller Robot');
            const details = form.getByRole('textbox', { name: 'Details (English)', exact: true });
            await details.click();
            await page.keyboard.type('Included accessories');
            await page.keyboard.press('Enter');
            await page.keyboard.type('USB cable');
            const tools = form.getByRole('group', {name: 'Details (English)', exact: true});
            await tools.getByRole('button', {name: 'Bullets', exact: true}).click();
            assert.equal(await details.locator('li').innerText(), 'USB cable');
            await details.locator('p').filter({hasText: 'Included accessories'}).click();
            await page.keyboard.press('Home');
            await page.keyboard.press('Shift+End');
            await tools.getByRole('button', {name: 'Bold', exact: true}).click();
            assert.equal(await details.locator('strong').innerText(), 'Included accessories');
            const remove = form.getByRole('button', { name: 'Remove variant' });
            assert.ok(await remove.first().isDisabled());
            await form.getByRole('button', { name: 'Add variant' }).click();
            for (const width of [1500, 390]) {
                await page.setViewportSize({ width, height: 1000 });
                const checkbox = form.getByRole('checkbox', { name: 'Available' }).nth(1);
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
                .getByLabel('Variant name', { exact: true })
                .fill('Browser robot');
            await form
                .getByLabel('SKU', { exact: true })
                .fill('BROWSER-SELLER-SKU');
            await form
                .getByLabel('Price (EGP)', { exact: true })
                .fill('145');
            await form.getByLabel('Stock', { exact: true }).fill('7');
            await form
                .getByRole('button', { name: 'Save product' })
                .click();
            await dialog.waitFor({ state: 'hidden' });
            await page
                .getByRole('status')
                .filter({ hasText: 'Saved' })
                .waitFor();
            await page
                .getByRole('cell', {
                    name: 'Browser Seller Robot',
                    exact: true,
                })
                .waitFor();
            await page.getByRole('row').filter({hasText: 'Browser Seller Robot'})
                .getByRole('button', {name: 'Edit'}).click();
            await form.getByRole('textbox', {name: 'Details (English)'}).locator('li').waitFor();
            assert.equal(await details.locator('strong').first().innerText(), 'Included accessories');
            assert.equal(await details.locator('li').innerText(), 'USB cable');
            assert.equal(await slug.inputValue(), 'custom-robot-kit');
            await page
                .getByRole('tab', {
                    name: 'Delivery rates',
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
                .getByRole('tab', { name: 'Orders', exact: true })
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
                    name: 'View items',
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
                    .getByRole('tab', { name: 'Payments', exact: true })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('button', {
                        name: 'Create pending refund',
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
                    name: 'Team & sellers',
                    exact: true,
                })
                .click();
            await page
                .getByRole('heading', { name: 'Create account' })
                .waitFor();
            await page
                .getByRole('tab', { name: 'Payments', exact: true })
                .click();
            await page
                .getByRole('heading', { name: 'Cash on Delivery', exact: true })
                .waitFor();
            await page.goto(
                `http://127.0.0.1:${f.port}/dashboard/shop-operations`,
            );
            await page
                .getByRole('heading', {
                    name: 'Shop operations',
                    exact: true,
                })
                .waitFor();
            await page
                .getByRole('tab', { name: 'Orders', exact: true })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings',
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
                .getByRole('button', { name: 'Open', exact: true })
                .click();
            await page
                .getByRole('heading', {
                    name: 'Order items & shipping',
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
                        name: 'Create pending refund',
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
                    name: 'Order items & shipping',
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
                    name: 'Add product',
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Products',
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
                    name: 'Create account',
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
                .getByRole('button', { name: 'Open', exact: true })
                .click();
            await page
                .getByRole('button', {
                    name: 'Download PDF',
                    exact: true,
                })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('heading', {
                        name: 'Order items & shipping',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Products',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('tab', {
                        name: 'Settings',
                        exact: true,
                    })
                    .count(),
                0,
            );
            assert.equal(await page.getByRole('alert').count(), 0);
            await page.close();
        },
    );
    await t.test('seller actions follow the saved Dashboard display language', async () => {
        const email = 'vendor-b@example.invalid';
        const page = await login(email);
        const add = page.getByRole('button', {name: 'Add product', exact: true});
        await add.waitFor();
        await page.getByRole('button').filter({hasText: email}).click();
        await page.getByText('Language', {exact: true}).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('combobox').first().click();
        await page.getByRole('option', {name: /^en\s/i}).waitFor();
        assert.equal(await page.getByRole('option').count(), 2);
        await page.getByRole('option', {name: /^ar\s/i}).click();
        await page.keyboard.press('Escape');
        await page.getByRole('button', {name: 'إضافة منتج', exact: true}).waitFor();
        await page.reload();
        await page.getByRole('tab', {name: 'المنتجات', exact: true}).click();
        await page.getByRole('button', {name: 'إضافة منتج', exact: true}).click();
        const productDialog = page.getByRole('dialog', {name: 'منتج جديد'});
        assert.equal(await productDialog.getAttribute('dir'), 'rtl');
        const form = productDialog.getByRole('form', {name: 'محرر المنتج'});
        await form.getByRole('button', {name: 'حفظ المنتج', exact: true}).waitFor();
        const toolbar = form.getByRole('group', {name: 'التفاصيل بالإنجليزية'});
        assert.equal(await toolbar.getByRole('button', {name: 'عريض'}).getAttribute('title'), 'عريض');
        assert.equal(await add.count(), 0);
        await page.close();
    });
}
