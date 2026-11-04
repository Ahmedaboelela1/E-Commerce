import {readFile, access} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('Skillverse storefront reuses the official logo SVG, not Vendure artwork', async () => {
    const svg = await readFile('public/skillverse-brand.svg', 'utf8');
    assert.match(svg, /<svg[^>]+viewBox=/);
    assert.match(svg, /#2E5EAB/i);
    assert.match(svg, /#102140/i);
    const navbar = await readFile('src/site/navigation/navbar.tsx', 'utf8');
    const footer = await readFile('src/site/footer.tsx', 'utf8');
    assert.match(navbar, /<SkillverseBrand compact/);
    assert.match(footer, /<SkillverseBrand inverse/);
    assert.doesNotMatch(navbar, /vendure\.svg|alt="Vendure"/);
    assert.doesNotMatch(footer, /vendure\.svg|Powered by Vendure/);
});

test('favicon uses Skillverse SVG instead of the Vendure ICO', async () => {
    const layout = await readFile('src/site/locale-layout.tsx', 'utf8');
    assert.match(layout, /icons:[\s\S]*?skillverse-brand\.svg/);
    await assert.rejects(access('src/app/[locale]/favicon.ico'));
});

test('footer includes official corporate contact and actual shop link', async () => {
    const footer = await readFile('src/site/footer.tsx', 'utf8');
    assert.match(footer, /info@skillverse-global\.com/);
    assert.match(footer, /href="\/search"/);
    assert.match(footer, /https:\/\/skillverse-global\.com\/contact/);
});
