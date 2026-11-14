import {LanguageCode, ShippingEligibilityChecker} from '@vendure/core';

import {egyptGovernorates} from './egypt-governorates';
export {egyptGovernorates} from './egypt-governorates';


const normalize = (name: string) => name.toLowerCase().replace(/محافظة|governorate/gi, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^a-z\u0621-\u064A]/g, '');
const aliases: Record<string, string> = {
    monufia: 'menofia', monofia: 'menofia', fayoum: 'faiyum', fayum: 'faiyum',
    asyut: 'assiut', assyut: 'assiut', kalubia: 'qalyubia', qalyoubia: 'qalyubia',
    minia: 'minya', elminya: 'minya', sharkia: 'sharqia', elsharkia: 'sharqia',
    kafrelsheikh: 'kafr-el-sheikh', kafralsheikh: 'kafr-el-sheikh',
    elbeheira: 'beheira', elgharbia: 'gharbia', eldakahlia: 'dakahlia',
};
export function resolveEgyptGovernorate(name: string): string | undefined {
    const normalized = normalize(name);
    return egyptGovernorates.find(names => names.some(value => normalize(value) === normalized))?.[0]
        || aliases[normalized];
}

/** One editable Shipping Method per governorate; its calculator owns the price. */
export const egyptGovernorateShippingChecker = new ShippingEligibilityChecker({
    code: 'egypt-governorate',
    description: [{languageCode: LanguageCode.en, value: 'Egypt delivery by governorate / الشحن حسب المحافظة'}],
    args: {
        governorate: {
            type: 'string',
            label: [{languageCode: LanguageCode.en, value: 'Governorate / المحافظة'}],
            ui: {
                component: 'select-form-input',
                options: egyptGovernorates.map(([value, en, ar]) => ({
                    value,
                    // Native Dashboard selects and summaries require localized labels.
                    label: [
                        {languageCode: LanguageCode.en, value: `${ar} / ${en}`},
                        {languageCode: LanguageCode.ar, value: `${ar} / ${en}`},
                    ],
                })),
            },
        },
    },
    check: (ctx, order, args) => ctx.channel.code === 'skillverse-eg'
        && order.currencyCode === 'EGP' && order.shippingAddress?.countryCode === 'EG'
        && !!args.governorate && resolveEgyptGovernorate(order.shippingAddress.province || '') === args.governorate,
});
