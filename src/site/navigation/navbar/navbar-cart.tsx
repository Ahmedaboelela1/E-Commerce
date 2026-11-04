import {cacheLife, cacheTag} from 'next/cache';
import {CartIcon} from './cart-icon';
import {query} from '@/platform/vendure/api';
import {GetActiveOrderQuery} from '@/features/cart/graphql';

export async function NavbarCart() {
    'use cache: private';
    cacheLife('minutes');
    cacheTag('cart');
    cacheTag('active-order');

    if (process.env.NEXT_PUBLIC_ENABLE_CHECKOUT !== 'true') {
        return null;
    }

    const orderResult = await query(GetActiveOrderQuery, undefined, {
        useAuthToken: true,
        tags: ['cart'],
    });

    const cartItemCount = orderResult.data.activeOrder?.totalQuantity || 0;

    return <CartIcon cartItemCount={cartItemCount} />;
}
