import {query} from '@/platform/vendure/api';
import {GetFilterCollectionsQuery, SearchProductsQuery} from './graphql';
import {
    buildSearchInput,
    selectedFacetIds,
    type CatalogParams,
} from './search-helpers';
export type FilterCollection = {id: string; name: string; slug: string};
export async function getFilterCollections(
    locale: string,
): Promise<FilterCollection[]> {
    const items: FilterCollection[] = [];
    let skip = 0,
        total = 1;
    while (skip < total) {
        const result = await query(
            GetFilterCollectionsQuery,
            {options: {take: 100, skip}},
            {languageCode: locale, fetch: {cache: 'no-store'}},
        );
        total = result.data.collections.totalItems;
        for (const c of result.data.collections.items)
            if (c.breadcrumbs.length > 1)
                items.push({
                    id: c.id,
                    slug: c.slug,
                    name: c.breadcrumbs
                        .slice(1)
                        .map((b) => b.name)
                        .join(' / '),
                });
        if (!result.data.collections.items.length) break;
        skip += 100;
    }
    return items;
}
export async function getCatalogData(
    params: CatalogParams,
    locale: string,
    currencyCode: string,
    collectionSlug?: string,
) {
    const options = {
        languageCode: locale,
        currencyCode,
        fetch: {cache: 'no-store' as const},
    };
    const collectionsPromise = getFilterCollections(locale).catch(() => []);
    const input = buildSearchInput({searchParams: params, collectionSlug});
    if (!selectedFacetIds(params.facets).length) {
        const promise = query(SearchProductsQuery, {input}, options);
        return {
            productDataPromise: promise,
            facetDataPromise: promise,
            collectionsPromise,
        };
    }
    const base = await query(
        SearchProductsQuery,
        {input: {...input, facetValueFilters: undefined, take: 0, skip: 0}},
        options,
    );
    const facetGroups = Object.fromEntries(
        base.data.search.facetValues.map((i) => [
            i.facetValue.id,
            i.facetValue.facet.id,
        ]),
    );
    return {
        productDataPromise: query(
            SearchProductsQuery,
            {
                input: buildSearchInput({
                    searchParams: params,
                    collectionSlug,
                    facetGroups,
                }),
            },
            options,
        ),
        facetDataPromise: Promise.resolve(base),
        collectionsPromise,
    };
}
