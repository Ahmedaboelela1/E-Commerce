import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Egypt initial import has exactly three priced INEX SKUs with unverified stock held at zero', () => {
    const lines = readFileSync(new URL('../catalog/egypt-inex-priced.csv', import.meta.url), 'utf8').trim().split(/\r?\n/);
    const columns = lines[0].split(',');
    const rows = lines.slice(1).map(line => Object.fromEntries(line.split(',').map((value, index) => [columns[index], value])));
    assert.equal(rows.length, 3);
    const prices = new Map(rows.map(row => [row.sku, Number(row.price)]));
    assert.equal(prices.get('8300158'), 25000);
    assert.equal(prices.get('8300155'), 20000);
    assert.equal(prices.get('8300153'), 25000);
    for (const row of rows) {
        assert.equal(row.stockOnHand, '0');
        assert.equal(row.trackInventory, 'true');
        assert.match(row['product:supplierUrl'], /^https:\/\/inex\.co\.th\/home\/product\//);
    }
});

test('Five inquiry-only supplier items have no fabricated Egypt price', () => {
    const products = JSON.parse(readFileSync(new URL('../catalog/on-request-inex.json', import.meta.url), 'utf8'));
    assert.equal(products.length, 5);
    for (const item of products) {
        assert.equal(item.priceEgp, null);
        assert.equal(item.availableOnOrder, false);
        assert.match(item.supplierUrl, /^https:\/\/inex\.co\.th\/home\/product\//);
    }
});
