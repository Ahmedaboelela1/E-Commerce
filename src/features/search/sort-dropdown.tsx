'use client';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/platform/i18n/navigation';
import {useTranslations} from 'next-intl';
import {getCatalogSort} from './search-helpers';
export function SortDropdown() {
    const t = useTranslations('Sort'),
        path = usePathname(),
        params = useSearchParams(),
        router = useRouter();
    return (
        <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
            {t('placeholder')}
            <select
                value={getCatalogSort(params.get('sort') || '')}
                className="h-11 max-w-full rounded-xl border border-input bg-background px-3 text-sm"
                onChange={(e) => {
                    const next = new URLSearchParams(params);
                    next.set('sort', e.target.value);
                    next.delete('page');
                    router.push(`${path}?${next}`);
                }}
            >
                {[
                    ['name-asc', 'nameAsc'],
                    ['name-desc', 'nameDesc'],
                    ['price-asc', 'priceAsc'],
                    ['price-desc', 'priceDesc'],
                ].map(([value, key]) => (
                    <option value={value} key={value}>
                        {t(key)}
                    </option>
                ))}
            </select>
        </label>
    );
}
