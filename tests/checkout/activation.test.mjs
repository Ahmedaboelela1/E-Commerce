import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScriptModule as load} from '../helpers/load-typescript-module.mjs';
import {isOfflinePaymentMethod} from '../../src/features/checkout/offline-payments.ts';

const text = async () => key => key;
const locale = async () => 'en';
const redirect = ({href}) => { throw new Error(`REDIRECT:${href}`); };
const documents = Object.fromEntries(['GetActiveOrderForCheckoutQuery', 'GetEligiblePaymentMethodsQuery', 'GetEligibleShippingMethodsQuery'].map(name => [name, name]));

test('cart and authenticated checkout are open with the legacy flag missing or false', async () => {
    const previous = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT;
    try {
        for (const flag of [undefined, 'false']) {
            if (flag === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CHECKOUT;
            else process.env.NEXT_PUBLIC_ENABLE_CHECKOUT = flag;
            const link = ({href, children}) => React.createElement('a', {href}, children);
            const summary = load('src/features/cart/routes/order-summary.tsx', {
                '@/platform/i18n/navigation': {Link: link},
                '@/components/ui/button': {Button: ({render, children}) => React.cloneElement(render, {}, children)},
                'lucide-react': {Lock: () => null},
                '@/features/pricing/price': {Price: () => null},
                'next-intl/server': {getTranslations: text},
            });
            const html = renderToStaticMarkup(await summary.OrderSummary({activeOrder: {id:'o1',currencyCode:'EGP',subTotalWithTax:10000,shippingWithTax:0,totalWithTax:10000}}));
            assert.match(html, /href="\/checkout"/);assert.doesNotMatch(html, /checkout-unavailable/);

            const provider = () => null;
            const page = load('src/features/checkout/routes/page.tsx', {
                '@/features/currency/currency-server': {getActiveCurrencyCode: async () => 'EGP'},
                '@/platform/i18n/server': {getRouteLocale: locale},
                'next-intl/server': {getTranslations: text},
                '@/platform/vendure/api': {query: async document => {
                    if (document === documents.GetActiveOrderForCheckoutQuery) return {data: {activeOrder: {state:'AddingItems',lines:[{id:'l1'}]}}};
                    if (document === documents.GetEligiblePaymentMethodsQuery) return {data: {eligiblePaymentMethods: [{code:'cash-on-delivery',isEligible:true},{code:'bank-transfer',isEligible:true},{code:'visa',isEligible:true}]}};
                    return {data: {eligibleShippingMethods:[],activeCustomer:{addresses:[]}}};
                }},
                '@/features/checkout/graphql': documents,
                '@/features/account/graphql': {GetCustomerAddressesQuery:'addresses'},
                '@/platform/i18n/navigation': {redirect},
                './checkout-flow': {default: () => null},
                './checkout-provider': {CheckoutProvider: provider},
                '@/config/metadata': {noIndexRobots: () => ({})},
                '@/features/account/customer': {getActiveCustomer: async () => ({id:'customer1'})},
                '@/features/checkout/countries': {getAvailableCountriesCached: async () => [{code:'EG'}]},
                '@/features/checkout/offline-payments': {isOfflinePaymentMethod},
            });
            const tree = await page.default();
            const checkout = React.Children.toArray(tree.props.children).find(child => child.type === provider);
            assert.ok(checkout);assert.equal(checkout.props.isGuest, false);
            assert.deepEqual(checkout.props.paymentMethods.map(method => method.code), ['cash-on-delivery','bank-transfer']);
        }
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CHECKOUT;
        else process.env.NEXT_PUBLIC_ENABLE_CHECKOUT = previous;
    }
});

test('opening checkout does not bypass the signed-in customer requirement', async () => {
    const page = load('src/features/checkout/routes/page.tsx', {
        '@/features/currency/currency-server': {}, '@/platform/i18n/server': {getRouteLocale: locale},
        'next-intl/server': {}, '@/platform/vendure/api': {query: () => assert.fail('guest must not query order data')},
        '@/features/checkout/graphql': documents, '@/features/account/graphql': {},
        '@/platform/i18n/navigation': {redirect}, './checkout-flow': {}, './checkout-provider': {},
        '@/config/metadata': {}, '@/features/account/customer': {getActiveCustomer: async () => null},
        '@/features/checkout/countries': {}, '@/features/checkout/offline-payments': {isOfflinePaymentMethod},
    });
    await assert.rejects(page.default(), /REDIRECT:\/sign-in\?redirectTo=\/checkout/);
});

test('authorized offline order placement ignores the retired flag while cards stay blocked', async () => {
    const previous = process.env.NEXT_PUBLIC_ENABLE_CHECKOUT;
    process.env.NEXT_PUBLIC_ENABLE_CHECKOUT = 'false';
    const mutations = [];
    try {
        const actions = load('src/features/checkout/routes/actions.ts', {
            '@/platform/vendure/api': {
                query: async () => ({data:{activeOrder:{lines:[{id:'l1'}],currencyCode:'EGP',shippingAddress:{phoneNumber:'01012345678',streetLine1:'Test street'}}}}),
                mutate: async (document, input) => {
                    mutations.push({document,input});
                    return document === 'transition'
                        ? {data:{transitionOrderToState:{__typename:'Order'}}}
                        : {data:{addPaymentToOrder:{__typename:'Order',code:'EG-TEST-1'}}};
                },
            },
            '@/features/checkout/graphql': {...documents,TransitionOrderToStateMutation:'transition',AddPaymentToOrderMutation:'payment'},
            '@/features/account/graphql': {}, 'next/cache': {revalidatePath(){},updateTag(){}},
            '@/platform/i18n/navigation': {redirect}, 'next-intl/server': {getLocale:locale},
            '@/features/account/customer': {getActiveCustomer:async()=>({id:'customer1'})},
            '@/features/checkout/offline-payments': {isOfflinePaymentMethod},
        });
        await assert.rejects(actions.placeOrder('bank-transfer'), /REDIRECT:\/order-confirmation\/EG-TEST-1/);
        assert.deepEqual(mutations.map(m=>m.document),['transition','payment']);
        assert.equal(mutations[1].input.input.method,'bank-transfer');
        await assert.rejects(actions.placeOrder('visa'),/Card payments are not available/);
        assert.equal(mutations.length,2,'card requests must not reach Vendure');
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_ENABLE_CHECKOUT;
        else process.env.NEXT_PUBLIC_ENABLE_CHECKOUT = previous;
    }
});
