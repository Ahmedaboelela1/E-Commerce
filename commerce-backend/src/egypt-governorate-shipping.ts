import {LanguageCode, ShippingEligibilityChecker} from '@vendure/core';

// Stable internal keys; accept the names customers enter in either language.
export const egyptGovernorates = [
    ['cairo', 'Cairo', 'القاهرة'], ['giza', 'Giza', 'الجيزة'],
    ['alexandria', 'Alexandria', 'الإسكندرية'], ['dakahlia', 'Dakahlia', 'الدقهلية'],
    ['red-sea', 'Red Sea', 'البحر الأحمر'], ['beheira', 'Beheira', 'البحيرة'],
    ['faiyum', 'Faiyum', 'الفيوم'], ['gharbia', 'Gharbia', 'الغربية'],
    ['ismailia', 'Ismailia', 'الإسماعيلية'], ['menofia', 'Menofia', 'المنوفية'],
    ['minya', 'Minya', 'المنيا'], ['qalyubia', 'Qalyubia', 'القليوبية'],
    ['new-valley', 'New Valley', 'الوادي الجديد'], ['suez', 'Suez', 'السويس'],
    ['aswan', 'Aswan', 'أسوان'], ['assiut', 'Assiut', 'أسيوط'],
    ['beni-suef', 'Beni Suef', 'بني سويف'], ['port-said', 'Port Said', 'بورسعيد'],
    ['damietta', 'Damietta', 'دمياط'], ['sharqia', 'Sharqia', 'الشرقية'],
    ['south-sinai', 'South Sinai', 'جنوب سيناء'], ['kafr-el-sheikh', 'Kafr El Sheikh', 'كفر الشيخ'],
    ['matrouh', 'Matrouh', 'مطروح'], ['luxor', 'Luxor', 'الأقصر'],
    ['qena', 'Qena', 'قنا'], ['north-sinai', 'North Sinai', 'شمال سيناء'],
    ['sohag', 'Sohag', 'سوهاج'],
] as const;

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
            ui: {component: 'select-form-input', options: egyptGovernorates.map(([value, en, ar]) => ({value, label: `${ar} / ${en}`}))},
        },
    },
    check: (ctx, order, args) => ctx.channel.code === 'skillverse-eg'
        && order.currencyCode === 'EGP' && order.shippingAddress?.countryCode === 'EG'
        && !!args.governorate && resolveEgyptGovernorate(order.shippingAddress.province || '') === args.governorate,
});
