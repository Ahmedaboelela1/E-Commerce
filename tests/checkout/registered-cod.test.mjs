import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('storefront keeps account and phone gating on checkout', () => {
    const page = fs.readFileSync('src/features/checkout/routes/page.tsx', 'utf8');
    const action = fs.readFileSync('src/features/checkout/routes/actions.ts', 'utf8');
    const form = fs.readFileSync('src/features/authentication/routes/register/registration-form.tsx', 'utf8');
    assert.match(page, /getActiveCustomer\(\)/);
    assert.match(page, /\/sign-in\?redirectTo=\/checkout/);
    assert.match(action, /!isOfflinePaymentMethod\(paymentMethodCode\)/);
    assert.match(action, /getActiveCustomer\(\)/);
    assert.match(action, /GUEST_CHECKOUT_DISABLED/);
    assert.match(form, /phoneNumber: z\.string\(\)\.trim\(\)\.refine/);
});

test('Visa stays disabled and order page says phone confirmation pending', () => {
    const payment = fs.readFileSync('src/features/checkout/routes/steps/payment-step.tsx', 'utf8');
    const checkout = fs.readFileSync('src/features/checkout/routes/page.tsx', 'utf8');
    const messages = JSON.parse(fs.readFileSync('src/features/orders/messages/en.json', 'utf8'));
    assert.match(payment, /visaComingSoon/);
    assert.match(checkout, /isOfflinePaymentMethod\(m.code\)/);
    assert.match(messages.OrderConfirmation.orderConfirmed, /request received/i);
    assert.match(messages.OrderConfirmation.emailConfirmation, /call you/i);
});
