import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../../../node_modules/playwright/index.mjs';
export async function marketplaceBrowserSuite(t, f) {
    const browser = await chromium.launch({
        executablePath: process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const artifacts = process.env.SUITE_ARTIFACT_DIR || f.root;
    await fs.mkdir(artifacts, { recursive: true });
    t.after(() => browser.close());
    async function login(email) {
        const page = await browser.newPage({
            viewport: { width: 1500, height: 1000 },
        });
        page.on('pageerror', (e) =>
            console.error('Dashboard browser error:', e.message),
        );
        await page.goto(`http://127.0.0.1:${f.port}/dashboard/`);
        await page.locator('#field-username').fill(email);
        await page.locator('#field-password').fill('synthetic-admin-password');
        await page.getByRole('button', { name: /Log in|Sign in/i }).click();
        await page.waitForURL((url) => !url.pathname.includes('login'));
        await page.goto(`http://127.0.0.1:${f.port}/dashboard/store-workspace`);
        await page
            .getByRole('heading', { name: 'Store workspace / إدارة المبيعات' })
            .waitFor();
        await page
            .getByRole('button', { name: 'Add product / إضافة منتج' })
            .waitFor();
        return page;
    }
    await t.test(
        'production Dashboard seller sees only owned catalog and can add a stocked product',
        async () => {
            const page = await login('vendor-b@example.invalid');
            await page.getByText('vendor-b-robot', { exact: true }).waitFor();
            assert.equal(
                await page.getByText('vendor-a-robot', { exact: true }).count(),
                0,
            );
            assert.equal(
                await page
                    .getByRole('button', {
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
            await form
                .getByLabel('URL slug', { exact: true })
                .fill('browser-seller-robot');
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
            await page
                .getByRole('button', {
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
            await page
                .getByRole('cell', { name: 'vendor-a-robot', exact: true })
                .waitFor();
            await page
                .getByRole('cell', { name: 'vendor-b-robot', exact: true })
                .waitFor();
            assert.equal(
                await page
                    .getByRole('link', { name: 'Global Settings', exact: true })
                    .count(),
                0,
            );
            await page
                .getByRole('button', {
                    name: 'Team & sellers / الحسابات والبائعون',
                    exact: true,
                })
                .click();
            await page
                .getByRole('heading', { name: 'Create account / إنشاء حساب' })
                .waitFor();
            await page
                .getByRole('button', { name: 'Payments / الدفع', exact: true })
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
            await page.screenshot({
                path: path.join(artifacts, 'store-admin-operations.png'),
                fullPage: true,
            });
            await page.close();
        },
    );
}
