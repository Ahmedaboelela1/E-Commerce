import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('COD is an unpaid authorization and guards guest checkout', () => {
    const handler = fs.readFileSync('src/egypt-cash-on-delivery.ts','utf8');
    assert.match(handler, /code: 'cash-on-delivery'/);
    assert.match(handler, /ctx.activeUserId/);
    assert.match(handler, /order.shippingAddress\?\.phoneNumber/);
    assert.match(handler, /order.currencyCode !== 'EGP'/);
    assert.match(handler, /state: 'Authorized'/);
    assert.doesNotMatch(handler, /state: 'Settled'/);
    assert.match(handler, /ctx.apiType !== 'admin'/);
});

test('Vendure backend registers only actual offline method without Visa', () => {
    const config = fs.readFileSync('src/vendure-config.ts','utf8');
    assert.match(config, /paymentMethodHandlers: \[egyptCashOnDeliveryHandler\]/);
    assert.match(config, /requireVerification: true/);
});
