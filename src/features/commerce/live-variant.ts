'use client';
import {useEffect, useState} from 'react';
import {useLocale} from 'next-intl';
import {loadGrowth} from './growth-client';
type Availability = {
    id: string | number;
    available: boolean;
    priceWithTax: number;
    currencyCode: string;
};
export function useLiveVariant(variantId: string | undefined) {
    const locale = useLocale();
    const [value, setValue] = useState<Availability | null>(null);
    useEffect(() => {
        if (!variantId) return;
        let active = true;
        const refresh = () => {
            void loadGrowth<{shopVariantAvailability: Availability}>(
                'variant',
                {id: variantId},
                locale,
            )
                .then((d) => {
                    if (active) setValue(d.shopVariantAvailability);
                })
                .catch(() => undefined);
        };
        refresh();
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            window.removeEventListener('focus', refresh);
        };
    }, [variantId, locale]);
    return value && String(value.id) === variantId ? value : null;
}
