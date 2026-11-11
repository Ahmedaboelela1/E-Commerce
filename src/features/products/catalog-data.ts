import {cacheLife, cacheTag} from 'next/cache';
import {getRouteLocale} from '@/platform/i18n/server';
import {query} from '@/platform/vendure/api';
import {SearchProductsQuery} from '@/features/search/graphql';

export async function getFeaturedCatalogProducts(currencyCode: string) {
    'use cache';
    cacheLife('minutes');
    const locale = await getRouteLocale();
    cacheTag(`featured-${locale}-${currencyCode}`);
    cacheTag('products');
    const result = await query(
        SearchProductsQuery,
        {input: {take: 12, skip: 0, groupByProduct: true}},
        {languageCode: locale, currencyCode},
    );
    return result.data.search.items;
}
