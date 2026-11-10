import {LanguageCode, PaymentMethodHandler, PaymentMethodService} from '@vendure/core';

let paymentMethods: PaymentMethodService;

export function transferInstructions(description: string): string {
    return description.replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

/** Manual InstaPay/bank transfer: no gateway and no automatic proof of payment. */
export const egyptBankTransferHandler = new PaymentMethodHandler({
    code: 'bank-transfer',
    description: [{languageCode: LanguageCode.en, value: 'InstaPay / Bank Transfer — manual verification'}],
    args: {},
    init: injector => { paymentMethods = injector.get(PaymentMethodService); },
    createPayment: async (ctx, order, amount, _args, _metadata, method) => {
        const digits = order.shippingAddress?.phoneNumber?.replace(/\D/g, '') || '';
        if (ctx.apiType !== 'shop' || !ctx.activeUserId || ctx.channel.code !== 'skillverse-eg'
            || order.currencyCode !== 'EGP' || order.shippingAddress?.countryCode !== 'EG'
            || digits.length < 10 || digits.length > 15 || amount <= 0) {
            return {amount, state: 'Declined' as const,
                errorMessage: 'A signed-in Egypt customer and valid delivery phone are required.'};
        }
        // Vendure passes an untranslated entity here. Load the authoritative
        // description with its translations rather than trusting client metadata.
        const configuredMethod = await paymentMethods.findOne(ctx, method.id);
        const instructions = transferInstructions(configuredMethod?.description || '');
        if (!instructions) {
            return {amount, state: 'Declined' as const, errorMessage: 'Bank transfer instructions are not configured.'};
        }
        return {
            amount, state: 'Authorized' as const,
            metadata: {paymentType: 'bank-transfer', transferVerification: 'pending', phoneConfirmation: 'pending',
                public: {paymentInstructions: instructions, reference: order.code}},
        };
    },
    settlePayment: async ctx => {
        if (ctx.apiType !== 'admin' || !ctx.activeUserId) {
            return {success: false, errorMessage: 'Only an administrator may confirm a received bank transfer.'};
        }
        return {success: true, metadata: {transferVerification: 'verified'}};
    },
});
