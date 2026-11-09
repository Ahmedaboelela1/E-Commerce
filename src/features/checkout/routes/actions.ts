'use server';

import {mutate, query} from '@/platform/vendure/api';
import {SetOrderShippingAddressMutation, SetOrderBillingAddressMutation, SetOrderShippingMethodMutation, AddPaymentToOrderMutation, TransitionOrderToStateMutation} from '@/features/checkout/graphql';
import {CreateCustomerAddressMutation} from '@/features/account/graphql';
import {revalidatePath, updateTag} from 'next/cache';
import {redirect} from '@/platform/i18n/navigation';
import {getLocale} from 'next-intl/server';
import {getActiveCustomer} from '@/features/account/customer';
import {GetActiveOrderForCheckoutQuery} from '@/features/checkout/graphql';

interface AddressInput {
    fullName: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
    company?: string;
}

export async function setShippingAddress(
    shippingAddress: AddressInput,
    useSameForBilling: boolean
) {
    const shippingResult = await mutate(
        SetOrderShippingAddressMutation,
        {input: shippingAddress},
        {useAuthToken: true}
    );

    if (shippingResult.data.setOrderShippingAddress.__typename !== 'Order') {
        throw new Error('Failed to set shipping address');
    }

    if (useSameForBilling) {
        await mutate(
            SetOrderBillingAddressMutation,
            {input: shippingAddress},
            {useAuthToken: true}
        );
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
}

export async function setShippingMethod(shippingMethodId: string) {
    const result = await mutate(
        SetOrderShippingMethodMutation,
        {shippingMethodId: [shippingMethodId]},
        {useAuthToken: true}
    );

    if (result.data.setOrderShippingMethod.__typename !== 'Order') {
        throw new Error('Failed to set shipping method');
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
}

export async function createCustomerAddress(address: AddressInput) {
    const result = await mutate(
        CreateCustomerAddressMutation,
        {input: address},
        {useAuthToken: true}
    );

    if (!result.data.createCustomerAddress) {
        throw new Error('Failed to create customer address');
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
    return result.data.createCustomerAddress;
}

export async function transitionToArrangingPayment() {
    const result = await mutate(
        TransitionOrderToStateMutation,
        {state: 'ArrangingPayment'},
        {useAuthToken: true}
    );

    if (result.data.transitionOrderToState?.__typename === 'OrderStateTransitionError') {
        const errorResult = result.data.transitionOrderToState;
        throw new Error(
            `Failed to transition order state: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    const locale = await getLocale();
    revalidatePath(`/${locale}/checkout`);
}

export async function placeOrder(paymentMethodCode: string) {
    if (process.env.NEXT_PUBLIC_ENABLE_CHECKOUT !== 'true') {
        throw new Error('Ordering is not enabled yet');
    }
    if (paymentMethodCode !== 'cash-on-delivery') {
        throw new Error('Card payments are not available yet');
    }
    const customer = await getActiveCustomer();
    if (!customer) {
        throw new Error('Please register and sign in before ordering');
    }
    const {data} = await query(GetActiveOrderForCheckoutQuery, {}, {useAuthToken: true});
    const order = data.activeOrder;
    if (!order?.lines?.length || !order.shippingAddress?.phoneNumber?.trim() || !order.shippingAddress.streetLine1?.trim()) {
        throw new Error('A delivery address and phone number are required for telephone confirmation');
    }
    if (order.currencyCode !== 'EGP') {
        throw new Error('Cash on delivery is available only for the Egypt store');
    }
    // First, transition the order to ArrangingPayment state
    await transitionToArrangingPayment();

    // COD creates an Authorized (uncollected) payment; no demo card metadata.
    const metadata: Record<string, unknown> = {};

    // Add payment to the order
    const result = await mutate(
        AddPaymentToOrderMutation,
        {
            input: {
                method: paymentMethodCode,
                metadata,
            },
        },
        {useAuthToken: true}
    );

    if (result.data.addPaymentToOrder.__typename !== 'Order') {
        const errorResult = result.data.addPaymentToOrder;
        throw new Error(
            `Failed to place order: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    const orderCode = result.data.addPaymentToOrder.code;

    // Update the cart tag to immediately invalidate cached cart data
    updateTag('cart');
    updateTag('active-order');

    const locale = await getLocale();
    redirect({href: `/order-confirmation/${orderCode}`, locale});
}

interface GuestCustomerInput {
    emailAddress: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}

export type SetCustomerForOrderResult =
    | { success: true }
    | { success: false; errorCode: 'EMAIL_CONFLICT'; message: string }
    | { success: false; errorCode: 'GUEST_CHECKOUT_DISABLED'; message: string }
    | { success: false; errorCode: 'NO_ACTIVE_ORDER'; message: string }
    | { success: false; errorCode: 'UNKNOWN'; message: string };

export async function setCustomerForOrder(
    _input: GuestCustomerInput
): Promise<SetCustomerForOrderResult> {
    // Guest checkout is permanently disabled for Skillverse Egypt.
    return {
        success: false,
        errorCode: 'GUEST_CHECKOUT_DISABLED',
        message: 'Please create a verified account and sign in before ordering',
    };
}
