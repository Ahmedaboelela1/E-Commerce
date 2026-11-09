import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const {SkillverseEmailTemplateLoader} = require('../dist/skillverse-email-templates.js');

const expectedTypes = [
    'email-verification',
    'password-reset',
    'admin-password-reset',
    'email-address-change',
    'order-confirmation',
    'order-request-received',
    'order-request-admin',
];

test('all transactional templates are bundled in compiled backend', async () => {
    const loader = new SkillverseEmailTemplateLoader();
    for (const type of expectedTypes) {
        const body = await loader.loadTemplate(undefined, undefined, {type, templateName: 'body.hbs'});
        assert.match(body, /<mjml>/);
        assert.match(body, /SkillVerse/);
    }
    await assert.rejects(loader.loadTemplate(undefined, undefined, {
        type: 'unknown-event',
        templateName: 'body.hbs',
    }), /No Skillverse transactional email template/);
});

test('email links use Vendure event tokens and correct store routes', async () => {
    const loader = new SkillverseEmailTemplateLoader();
    const cases = {
        'email-verification': ['verifyEmailAddressUrl', 'verificationToken'],
        'password-reset': ['passwordResetUrl', 'passwordResetToken'],
        'admin-password-reset': ['adminPasswordResetUrl', 'passwordResetToken'],
        'email-address-change': ['changeEmailAddressUrl', 'identifierChangeToken'],
    };
    for (const [type, names] of Object.entries(cases)) {
        const body = await loader.loadTemplate(undefined, undefined, {type, templateName: 'body.hbs'});
        for (const name of names) assert.ok(body.includes(name), `${type} missing ${name}`);
    }
});

test('COD email says request pending call, not paid or dispatched', async () => {
    const loader = new SkillverseEmailTemplateLoader();
    const customer = await loader.loadTemplate(undefined, undefined, {
        type: 'order-request-received',
        templateName: 'body.hbs',
    });
    assert.match(customer, /call your delivery phone/i);
    assert.match(customer, /No payment has been collected/i);
    const staff = await loader.loadTemplate(undefined, undefined, {
        type: 'order-request-admin',
        templateName: 'body.hbs',
    });
    assert.match(staff, /before confirmation/i);
});

test('SMTP is opt-in and never exposes credentials or dev mailbox in production', () => {
    const plugin = fs.readFileSync('src/skillverse-smtp-plugin.ts', 'utf8');
    assert.match(plugin, /SMTP_ENABLED !== 'true'/);
    assert.match(plugin, /smtp\.hostinger\.com/);
    assert.match(plugin, /port === 465/);
    assert.match(plugin, /port === 587/);
    assert.match(plugin, /devMode/);
    assert.doesNotMatch(plugin, /route:\s*['"]mailbox['"]/);
});
