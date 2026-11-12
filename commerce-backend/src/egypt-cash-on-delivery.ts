import {LanguageCode, PaymentMethodHandler} from '@vendure/core';

/**
 * Offline COD only for Skillverse Egypt.
 *
 * Authorized is deliberately NOT Settled. At placement, neither a card
 * authorization nor any cash collection has occurred: this records only an
 * intention to collect on delivery, after a phone confirmation.
 *
 * The order must be reviewed by staff before shipment, and settlement must
 * be done by an authorized administrator only after cash is actually received.
 */
export const egyptCashOnDeliveryHandler = new PaymentMethodHandler({
    code: 'cash-on-delivery',
    description: [{
        languageCode: LanguageCode.en,
        value: 'Cash on delivery - pending phone confirmation and cash collection',
    }],
    args: {},
    createPayment: async (ctx, order, amount) => {
        // The Shop API also supports guest checkout by default; never let it
        // bypass Skillverse's required registered and authenticated account.
        if (ctx.apiType !== 'shop' || !ctx.activeUserId) {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'Please sign in with a verified customer account before ordering.',
            };
        }
        if (order.currencyCode !== 'EGP') {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'Cash on delivery is only available for the Egypt (EGP) store.',
            };
        }
        const digits = order.shippingAddress?.phoneNumber?.replace(/[^0-9]/g, '') || '';
        if (digits.length < 10 || digits.length > 15) {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'A delivery phone number is required for order confirmation.',
            };
        }
        if (amount <= 0) {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'Cash on delivery requires a positive order total.',
            };
        }

        return {
            amount,
            state: 'Authorized' as const,
            metadata: {
                paymentType: 'cash-on-delivery',
                public: {paymentType:'cash-on-delivery'},
                phoneConfirmation: 'pending',
                cashCollection: 'not-collected',
            },
        };
    },
    settlePayment: async (ctx) => {
        // Never treat a customer call as proof of cash collection.
        if (ctx.apiType !== 'admin' || !ctx.activeUserId) {
            return {
                success: false,
                errorMessage: 'Only an authorized administrator may record cash collection.',
            };
        }
        return {success: true};
    },
});
