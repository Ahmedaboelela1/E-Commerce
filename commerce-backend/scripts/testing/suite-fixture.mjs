import {spawn, execFile} from 'node:child_process';
import {once} from 'node:events';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import mysql from 'mysql2/promise';
import {smtpCapture} from './smtp-capture.mjs';

export async function waitFor(check, message, timeout = 60000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await check()) return;
        await new Promise((r) => setTimeout(r, 200));
    }
    throw Error(message);
}
async function freePort() {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

export async function suiteFixture(t) {
    const database = 'vendure_suite_ci';
    const control = await mysql.createConnection({
        host: '127.0.0.1',
        port: Number(process.env.VENDURE_EMAIL_TEST_PORT),
        user: 'root',
        password: 'ci-vendure-test-password',
    });
    await control.query('CREATE DATABASE IF NOT EXISTS ' + database);
    const [[count]] = await control.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?',
        [database],
    );
    if (Number(count.n))
        throw Error('Suite fixture requires its own empty disposable database');
    const smtp = await smtpCapture();
    const port = await freePort();
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skillverse-suite-'));
    const env = {
        ...process.env,
        APP_ENV: 'dev',
        DB_HOST: '127.0.0.1',
        DB_PORT: process.env.VENDURE_EMAIL_TEST_PORT,
        DB_NAME: database,
        DB_USERNAME: 'root',
        DB_PASSWORD: 'ci-vendure-test-password',
        PORT: String(port),
        SUPERADMIN_USERNAME: 'suite-admin@example.invalid',
        SUPERADMIN_PASSWORD: 'suite-synthetic-admin-password',
        COOKIE_SECRET: 'suite-synthetic-cookie-secret-with-over-32-characters',
        HOSTINGER_INITIALIZE_COUNTRIES: 'YES_NEW_EMPTY_DATABASE',
        RUN_JOBS_IN_SERVER: 'true',
        ASSET_UPLOAD_DIR: path.join(root, 'assets'),
        PRIVATE_RECEIPT_DIR: path.join(root, 'private-receipts'),
        ASSET_URL_PREFIX: `http://localhost:${port}/assets/`,
        EMAIL_ENABLED: 'true',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_USER: 'ahmed@skillverse-global.com',
        SMTP_PASSWORD: 'suite-synthetic-smtp-password',
        EMAIL_FROM_ADDRESS: 'info@skillverse-global.com',
        EMAIL_ADMIN_TO: 'suite-ops@example.invalid',
        STOREFRONT_PUBLIC_URL: 'https://shop.example.invalid',
        BACKEND_PUBLIC_URL: 'https://api.example.invalid',
    };
    let logs = '',
        channelToken = '',
        adminToken = '';
    const child = spawn(process.execPath, ['dist/index.js'], {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => (logs += chunk));
    child.stderr.on('data', (chunk) => (logs += chunk));
    t.after(async () => {
        if (child.exitCode === null) {
            child.kill('SIGTERM');
            await once(child, 'exit');
        }
        await smtp.close();
        await control.query('DROP DATABASE ' + database);
        await control.end();
        await fs.rm(root, {recursive: true, force: true});
    });
    const url = (admin) =>
        `http://127.0.0.1:${port}/${admin ? 'admin-api' : 'shop-api'}`;
    async function raw(query, variables = {}, options = {}) {
        const response = await fetch(url(options.admin), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apollo-Require-Preflight': 'true',
                ...(options.token
                    ? {Authorization: 'Bearer ' + options.token}
                    : {}),
                ...((options.channel ?? channelToken)
                    ? {'vendure-token': options.channel ?? channelToken}
                    : {}),
            },
            body: JSON.stringify({query, variables}),
        });
        const result = await response.json();
        return {...result, token: response.headers.get('vendure-auth-token')};
    }
    async function query(query, variables = {}, options = {}) {
        const result = await raw(query, variables, options);
        if (result.errors) throw Error(JSON.stringify(result.errors));
        return result;
    }
    await waitFor(async () => {
        if (child.exitCode !== null) throw Error(logs.slice(-3000));
        try {
            return !!(await query('{activeChannel{code}}')).data.activeChannel;
        } catch {
            return false;
        }
    }, 'Suite API failed to start');
    await promisify(execFile)(
        process.execPath,
        ['scripts/provision-egypt.mjs'],
        {
            env: {
                ...env,
                ADMIN_API_URL: `http://localhost:${port}/admin-api`,
                EGYPT_SELLER_LEGAL_NAME: 'Suite synthetic seller — not real',
                PROVISION_APPLY: 'YES_I_APPROVE_EGYPT_SETUP',
                EGYPT_AGENT_ADMIN_EMAIL: '',
            },
        },
    );
    const login = await query(
        'mutation($u:String!,$p:String!){login(username:$u,password:$p){__typename ... on CurrentUser{id}}}',
        {u: env.SUPERADMIN_USERNAME, p: env.SUPERADMIN_PASSWORD},
        {admin: true},
    );
    adminToken = login.token;
    const admin = (q, v = {}, extra = {}) =>
        query(q, v, {admin: true, token: adminToken, ...extra});
    const setup = (
        await admin(
            '{channels{items{id code token}} stockLocations{items{id name}} zones{items{id name}}}',
        )
    ).data;
    const channel = setup.channels.items.find(
        (c) => c.code === 'skillverse-eg',
    );
    channelToken = channel.token;
    const location = setup.stockLocations.items.find(
        (s) => s.name === 'Egypt — Local Agent Warehouse',
    );
    const tax = (
        await admin(
            'mutation{createTaxCategory(input:{name:"Suite test zero-tax category",isDefault:true}){id}}',
        )
    ).data.createTaxCategory;
    await admin(
        'mutation($input:CreateTaxRateInput!){createTaxRate(input:$input){id}}',
        {
            input: {
                name: 'Suite test zero tax',
                enabled: true,
                value: 0,
                categoryId: tax.id,
                zoneId: setup.zones.items.find((z) => z.name === 'Egypt').id,
            },
        },
    );
    const product = (
        await admin(
            'mutation($input:CreateProductInput!){createProduct(input:$input){id slug}}',
            {
                input: {
                    enabled: true,
                    translations: [
                        {
                            languageCode: 'en',
                            name: 'Suite Test Robot',
                            slug: 'suite-test-robot',
                            description:
                                'Synthetic test product — never production data',
                        },
                    ],
                },
            },
        )
    ).data.createProduct;
    if (process.env.SUITE_DESIGN === 'true') {
        const {default: sharp} = await import('sharp');
        const assetIds = [];
        for (const color of ['#2e5eab', '#0f766e']) {
            const png = await sharp(
                Buffer.from(
                    `<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="600" fill="white"/><rect x="110" y="100" width="380" height="400" rx="70" fill="${color}"/><circle cx="225" cy="245" r="28" fill="white"/><circle cx="375" cy="245" r="28" fill="white"/><path d="M225 355h150" stroke="white" stroke-width="20"/><text x="300" y="560" font-size="28" text-anchor="middle" fill="#102140">Synthetic test image</text></svg>`,
                ),
            )
                .png()
                .toBuffer();
            const form = new FormData();
            form.set(
                'operations',
                JSON.stringify({
                    query: 'mutation($input:[CreateAssetInput!]!){createAssets(input:$input){__typename ... on Asset{id} ... on ErrorResult{message}}}',
                    variables: {input: [{file: null}]},
                }),
            );
            form.set('map', JSON.stringify({0: ['variables.input.0.file']}));
            form.set(
                '0',
                new Blob([png], {type: 'image/png'}),
                'suite-design.png',
            );
            const response = await fetch(url(true), {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + adminToken,
                    'vendure-token': channelToken,
                    'Apollo-Require-Preflight': 'true',
                },
                body: form,
            });
            const result = await response.json();
            if (
                result.errors ||
                result.data?.createAssets?.[0]?.__typename !== 'Asset'
            )
                throw Error(
                    'Synthetic catalog image upload failed: ' +
                        JSON.stringify(result),
                );
            assetIds.push(result.data.createAssets[0].id);
        }
        await admin(
            'mutation($input:UpdateProductInput!){updateProduct(input:$input){id}}',
            {input: {id: product.id, assetIds, featuredAssetId: assetIds[0]}},
        );
    }
    const variant = (
        await admin(
            'mutation($input:[CreateProductVariantInput!]!){createProductVariants(input:$input){id}}',
            {
                input: [
                    {
                        productId: product.id,
                        sku: 'SUITE-ROBOT',
                        price: 10000,
                        taxCategoryId: tax.id,
                        trackInventory: 'TRUE',
                        stockLevels: [
                            {stockLocationId: location.id, stockOnHand: 20},
                        ],
                        translations: [
                            {languageCode: 'en', name: 'Suite Test Robot'},
                        ],
                    },
                ],
            },
        )
    ).data.createProductVariants[0];
    const shipping = (
        await admin(
            'mutation($input:CreateShippingMethodInput!){createShippingMethod(input:$input){id}}',
            {
                input: {
                    code: 'suite-aramex-cairo',
                    fulfillmentHandler: 'manual-fulfillment',
                    checker: {
                        code: 'egypt-governorate',
                        arguments: [{name: 'governorate', value: 'cairo'}],
                    },
                    calculator: {
                        code: 'default-shipping-calculator',
                        arguments: [
                            {name: 'rate', value: '11500'},
                            {name: 'includesTax', value: 'include'},
                            {name: 'taxRate', value: '0'},
                        ],
                    },
                    translations: [
                        {
                            languageCode: 'en',
                            name: 'Suite Aramex Cairo',
                            description: 'Synthetic test delivery rate',
                        },
                    ],
                },
            },
        )
    ).data.createShippingMethod;
    for (const code of ['cash-on-delivery', 'bank-transfer'])
        await admin(
            'mutation($input:CreatePaymentMethodInput!){createPaymentMethod(input:$input){id}}',
            {
                input: {
                    code,
                    enabled: true,
                    handler: {code, arguments: []},
                    translations: [
                        {
                            languageCode: 'en',
                            name:
                                code === 'bank-transfer'
                                    ? 'InstaPay / Bank Transfer'
                                    : 'Cash on Delivery',
                            description:
                                code === 'bank-transfer'
                                    ? 'CI public receiving instructions — not a real account'
                                    : 'CI COD test',
                        },
                    ],
                },
            },
        );
    async function customer(email) {
        await query(
            'mutation($input:RegisterCustomerInput!){registerCustomerAccount(input:$input){__typename ... on ErrorResult{message}}}',
            {
                input: {
                    emailAddress: email,
                    password: 'suite-customer-password',
                    firstName: 'Suite',
                    lastName: 'Customer',
                    phoneNumber: '01012345678',
                },
            },
        );
        await waitFor(
            () =>
                smtp.messages.some((m) =>
                    m.recipients.some((r) => r.includes(email)),
                ),
            'Verification mail missing',
        );
        const mail = smtp.messages
            .find((m) => m.recipients.some((r) => r.includes(email)))
            .raw.replace(/=\r\n/g, '')
            .replace(/=3D/g, '=');
        const match = mail.match(
            /https:\/\/shop\.example\.invalid\/en\/verify\?token=([^\s<"']+)/,
        );
        if (!match) throw Error('Missing verification token');
        const verification = new URL(
            'https://shop.example.invalid/en/verify?token=' + match[1],
        ).searchParams.get('token');
        await query(
            'mutation($token:String!){verifyCustomerAccount(token:$token){__typename ... on ErrorResult{message}}}',
            {token: verification},
        );
        const signed = await query(
            'mutation($u:String!){login(username:$u,password:"suite-customer-password"){__typename ... on CurrentUser{id}}}',
            {u: email},
        );
        if (!signed.token) throw Error('Customer did not log in');
        return signed.token;
    }
    return {
        control,
        database,
        smtp,
        root,
        env,
        port,
        url,
        raw,
        query,
        admin,
        channel,
        location,
        product,
        variant,
        shipping,
        customer,
        get adminToken() {
            return adminToken;
        },
        get channelToken() {
            return channelToken;
        },
        get logs() {
            return logs;
        },
    };
}
