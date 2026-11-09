'use server';

import {mutate} from '@/platform/vendure/api';
import {RegisterCustomerAccountMutation} from '@/features/authentication/graphql';
import {redirect} from '@/platform/i18n/navigation';
import {getLocale, getTranslations} from 'next-intl/server';

export async function registerAction(prevState: { error?: string } | undefined, formData: FormData) {
    const t = await getTranslations('Errors');
    const emailAddress = formData.get('emailAddress') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const password = formData.get('password') as string;
    const redirectTo = formData.get('redirectTo') as string | null;

    // Registration is the first step of the phone-confirmed Egypt checkout.
    // Server-side validation prevents bypassing the browser form.
    if (!emailAddress || !password) {
        return {error: t('emailPasswordRequired')};
    }
    if (!firstName?.trim() || !lastName?.trim()) {
        return {error: 'First and last name are required'};
    }
    const phone = phoneNumber?.trim() || '';
    if (!/^\+?[0-9 ()-]{10,20}$/.test(phone) || phone.replace(/\D/g, '').length < 10) {
        return {error: 'Enter a valid phone number so we can confirm your order'};
    }


    const result = await mutate(RegisterCustomerAccountMutation, {
        input: {
            emailAddress,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phoneNumber: phone,
            password,
        }
    });

    const registerResult = result.data.registerCustomerAccount;

    if (registerResult.__typename !== 'Success') {
        return {error: registerResult.message};
    }

    // Redirect to verification pending page, preserving redirectTo if present
    const verifyUrl = redirectTo
        ? `/verify-pending?redirectTo=${encodeURIComponent(redirectTo)}`
        : '/verify-pending';

    const locale = await getLocale();
    redirect({href: verifyUrl, locale});

}
