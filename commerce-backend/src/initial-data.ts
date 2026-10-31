import {InitialData, LanguageCode} from '@vendure/core';

// Run only against a reviewed, empty Vendure database after migrations.
// Tax, shipping and payment policies require approval by each local merchant.
export const initialData: InitialData = {
    defaultLanguage: LanguageCode.en,
    defaultZone: 'Egypt',
    countries: [
        {name: 'Egypt', code: 'EG', zone: 'Egypt'},
        {name: 'Saudi Arabia', code: 'SA', zone: 'Saudi Arabia'},
        {name: 'Tunisia', code: 'TN', zone: 'Tunisia'},
    ],
    taxRates: [],
    shippingMethods: [],
    paymentMethods: [],
    collections: [],
};
