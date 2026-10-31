#!/usr/bin/env node
/**
 * Idempotent channel + roles + optional agent administrator provisioning.
 * Requires a newly deployed Vendure Admin API and a seeded database.
 * Staging-first; requires explicit operator confirmation and env credentials.
 * No secrets or generated tokens are logged to stdout.
 */
import {randomBytes} from 'node:crypto';
import 'dotenv/config';

const apiUrl = process.env.ADMIN_API_URL;
const dryRun = process.env.PROVISION_APPLY !== 'YES_I_APPROVE_EGYPT_SETUP';
const countryCode = 'skillverse-eg';
const legalName = process.env.EGYPT_SELLER_LEGAL_NAME?.trim();

if (!apiUrl || !/^https:\/\//.test(apiUrl) && !/^http:\/\/localhost[:/]/.test(apiUrl)) {
    throw new Error('ADMIN_API_URL must be HTTPS or local development HTTP.');
}
if (!legalName) throw new Error('Set EGYPT_SELLER_LEGAL_NAME to the actual local merchant legal name.');
if (!process.env.SUPERADMIN_USERNAME || !process.env.SUPERADMIN_PASSWORD) {
    throw new Error('Set SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD in your private shell/deployment environment.');
}

let bearer;
async function gql(query, variables = {}) {
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearer ? {Authorization: `Bearer ${bearer}`} : {}),
        },
        body: JSON.stringify({query, variables}),
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Admin API request failed (HTTP ${response.status})`);
    const token = response.headers.get('vendure-auth-token');
    if (token) bearer = token;
    const result = await response.json();
    if (result.errors?.length) {
        throw new Error('Admin API GraphQL error: ' + result.errors.map(x => x.message).join('; '));
    }
    return result.data;
}
function ensureValid(entity, label) {
    if (entity?.__typename && entity.__typename !== label) {
        throw new Error(`${label} operation failed: ${entity.message || entity.__typename}`);
    }
    if (!entity?.id) throw new Error('Missing ID in ' + label + ' operation');
    return entity;
}
async function findItem(query, key, predicate) {
    const result = await gql(query);
    return result[key]?.items?.find(predicate);
}

console.log(dryRun ? 'PREVIEW: no changes will be made.' : 'Applying country setup to approved Vendure instance.');
if (dryRun) {
    console.log('Actions: verify admin; create Egypt seller; create EGP channel; create stock location; add 2 channel-scoped roles; optionally create one Egypt admin.');
    console.log('To apply, set PROVISION_APPLY=YES_I_APPROVE_EGYPT_SETUP in the private deployment environment.');
    process.exit(0);
}
const login = await gql(
    `mutation Login($username: String!, $password: String!){
        login(username:$username,password:$password) {
            __typename
            ... on CurrentUser {id identifier}
            ... on ErrorResult {message}
        }
    }`,
    {username:process.env.SUPERADMIN_USERNAME,password:process.env.SUPERADMIN_PASSWORD},
);
ensureValid(login.login, 'CurrentUser');
if (!bearer) throw new Error('Vendure did not return the expected bearer token; check server authOptions.');

const data = await gql(`query SetupLookup {
    zones {items {id name}}
    sellers {items {id name}}
    channels {items {id code token}}
    stockLocations {items {id name}}
    roles {items {id code}}
    administrators {items {id emailAddress}}
}`);
const egyptZone = data.zones.items.find(x => x.name === 'Egypt');
if (!egyptZone) throw new Error('Egypt zone does not exist: run the reviewed initial seed first.');

let seller = data.sellers.items.find(x => x.name === legalName);
if (!seller) {
    seller = (await gql(
        `mutation CreateSeller($input: CreateSellerInput!) {createSeller(input:$input) {id name}}`,
        {input:{name:legalName}},
    )).createSeller;
}
ensureValid(seller, 'Seller');

let channel = data.channels.items.find(x => x.code === countryCode);
if (!channel) {
    const input = {
        code:countryCode,
        token:randomBytes(24).toString('hex'),
        defaultLanguageCode:'en',
        availableLanguageCodes:['en'],
        pricesIncludeTax:false,
        defaultCurrencyCode:'EGP',
        availableCurrencyCodes:['EGP'],
        defaultTaxZoneId:egyptZone.id,
        defaultShippingZoneId:egyptZone.id,
        sellerId:seller.id,
    };
    channel = ensureValid((await gql(
        `mutation NewChannel($input: CreateChannelInput!){
            createChannel(input:$input) {
                __typename
                ... on Channel {id code token}
                ... on ErrorResult {message}
            }
        }`,
        {input},
    )).createChannel, 'Channel');
}
console.log('Channel ready: ' + channel.code + ' (credentials not printed)');

const stockName = 'Egypt — Local Agent Warehouse';
let stock = data.stockLocations.items.find(x => x.name === stockName);
if (!stock) {
    stock = (await gql(
        `mutation NewLocation($input: CreateStockLocationInput!) {
            createStockLocation(input:$input) {id name}
        }`,
        {input:{name:stockName,description:'Local Egypt agent stock; unit counts must be physically confirmed'}},
    )).createStockLocation;
}
ensureValid(stock, 'StockLocation');
await gql(
    `mutation AssignLocation($input: AssignStockLocationsToChannelInput!) {
        assignStockLocationsToChannel(input:$input) {id name}
    }`,
    {input:{stockLocationIds:[stock.id],channelId:channel.id}},
);

const roleDefinitions = [
    {
        code:'skillverse-eg-order-operations',
        description:'Egypt agent: order and customer operations; no global settings or product publication',
        permissions:['ReadCatalog','ReadOrder','UpdateOrder','ReadCustomer','ReadSettings'],
    },
    {
        code:'skillverse-eg-catalog-inventory',
        description:'Egypt local product and stock operations; limited by channel; review shared entity behavior',
        permissions:['ReadCatalog','UpdateCatalog','ReadSettings'],
    },
];
const roles = {};
for (const definition of roleDefinitions) {
    let role = data.roles.items.find(x => x.code === definition.code);
    if (!role) {
        role = (await gql(
            `mutation NewRole($input: CreateRoleInput!) {createRole(input:$input) {id code}}`,
            {input:{...definition,channelIds:[channel.id]}},
        )).createRole;
    }
    ensureValid(role, 'Role');
    roles[definition.code] = role.id;
}
console.log('Egypt channel-scoped roles ready: ' + roleDefinitions.length);

const email = process.env.EGYPT_AGENT_ADMIN_EMAIL?.trim().toLowerCase();
if (email) {
    if (!process.env.EGYPT_AGENT_ADMIN_PASSWORD || process.env.EGYPT_AGENT_ADMIN_PASSWORD.length < 20) {
        throw new Error('EGYPT_AGENT_ADMIN_PASSWORD is required and must be 20+ characters.');
    }
    const existing = data.administrators.items.find(x => x.emailAddress.toLowerCase() === email);
    if (!existing) {
        await gql(
            `mutation NewAdministrator($input: CreateAdministratorInput!) {
                createAdministrator(input:$input) {id emailAddress}
            }`,
            {input:{
                firstName:process.env.EGYPT_AGENT_FIRST_NAME || 'Egypt',
                lastName:process.env.EGYPT_AGENT_LAST_NAME || 'Agent',
                emailAddress:email,
                password:process.env.EGYPT_AGENT_ADMIN_PASSWORD,
                roleIds:[roles['skillverse-eg-order-operations']],
            }},
        );
        console.log('Egypt agent administrator created (password not shown).');
    } else {
        console.log('Egypt agent administrator already exists: left unchanged.');
    }
}
console.log('Egypt provisioning complete. Review channel token, payment, inventory, tax and shipping in Vendure Dashboard before launch.');
