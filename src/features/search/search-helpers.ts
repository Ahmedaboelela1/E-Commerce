export type CatalogParams = {[key: string]: string | string[] | undefined};
export type CatalogSort = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
export const sortMapping: Record<
    CatalogSort,
    {name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC'}
> = {
    'name-asc': {name: 'ASC'},
    'name-desc': {name: 'DESC'},
    'price-asc': {price: 'ASC'},
    'price-desc': {price: 'DESC'},
};
export const firstParam = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] || '' : value || '';
export const getCatalogSort = (
    value: string | string[] | undefined,
): CatalogSort => {
    const input = firstParam(value);
    return Object.hasOwn(sortMapping, input)
        ? (input as CatalogSort)
        : 'name-asc';
};
export function selectedFacetIds(value: string | string[] | undefined) {
    return [
        ...new Set(
            (Array.isArray(value) ? value : [value]).filter(
                (id): id is string =>
                    typeof id === 'string' && /^[1-9]\d{0,15}$/.test(id),
            ),
        ),
    ].slice(0, 32);
}
export function getCurrentPage(searchParams: CatalogParams) {
    const page = Number(firstParam(searchParams.page));
    return Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
}
export interface SearchInputParams {
    term?: string;
    collectionSlug?: string;
    take: number;
    skip: number;
    groupByProduct: boolean;
    sort: {name?: 'ASC' | 'DESC'; price?: 'ASC' | 'DESC'};
    facetValueFilters?: Array<{and: string} | {or: string[]}>;
    inStock?: boolean;
}
export function buildSearchInput({
    searchParams,
    collectionSlug,
    facetGroups = {},
}: {
    searchParams: CatalogParams;
    collectionSlug?: string;
    facetGroups?: Record<string, string>;
}): SearchInputParams {
    const term = firstParam(searchParams.q).trim().slice(0, 200),
        collection =
            collectionSlug || firstParam(searchParams.collection).slice(0, 200);
    const grouped = new Map<string, string[]>();
    for (const id of selectedFacetIds(searchParams.facets)) {
        const key = facetGroups[id] || 'value:' + id;
        grouped.set(key, [...(grouped.get(key) || []), id]);
    }
    return {
        ...(term ? {term} : {}),
        ...(collection ? {collectionSlug: collection} : {}),
        take: 12,
        skip: (getCurrentPage(searchParams) - 1) * 12,
        groupByProduct: true,
        sort: sortMapping[getCatalogSort(searchParams.sort)],
        ...(firstParam(searchParams.stock) === '1' ? {inStock: true} : {}),
        ...(grouped.size
            ? {
                  facetValueFilters: [...grouped.values()].map((ids) =>
                      ids.length === 1 ? {and: ids[0]} : {or: ids},
                  ),
              }
            : {}),
    };
}
