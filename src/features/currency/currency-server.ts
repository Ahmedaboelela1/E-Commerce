import {getCurrencyCookie} from './currency';
import {getActiveChannel} from '@/platform/vendure/channel';

/**
 * Get the active currency code for the current request.
 * Reads from cookie, falls back to channel default.
 *
 * Safe inside 'use cache: private' (cookies are part of the per-user cache key).
 * NOT safe inside public 'use cache' — pass currency as a parameter instead.
 */
export async function getActiveCurrencyCode(): Promise<string> {
    const cookieValue = await getCurrencyCookie();
    const channel = await getActiveChannel();
    // A visitor may still have a USD cookie from the old demo storefront.
    // Never request an unsupported currency from the EGP-only Egypt channel.
    if (cookieValue && channel.availableCurrencyCodes.includes(cookieValue as typeof channel.availableCurrencyCodes[number])) {
        return cookieValue;
    }
    return channel.defaultCurrencyCode;
}
