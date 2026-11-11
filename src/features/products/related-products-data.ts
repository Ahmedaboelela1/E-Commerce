import {query} from '@/platform/vendure/api';
import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {
    GetRelatedProductContextQuery,
    GetRelatedProductsQuery,
    ProductCardFragment,
} from './graphql';

export async function getRelatedProducts(
    productId: string,
    locale: string,
    currencyCode: string,
) {
    const options = {
        languageCode: locale,
        currencyCode,
        fetch: {cache: 'no-store' as const},
    };
    const {data} = await query(
        GetRelatedProductContextQuery,
        {id: productId},
        options,
    );
    if (!data.product) return null;
    const items: Array<FragmentOf<typeof ProductCardFragment>> = [];
    const seen = new Set([productId]);
    const collect = (candidates: typeof items) => {
        for (const item of candidates) {
            const id = readFragment(ProductCardFragment, item).productId;
            if (!seen.has(id) && items.length < 4) {
                seen.add(id);
                items.push(item);
            }
        }
    };
    const collections = data.product.collections
        .filter((c) => c.breadcrumbs.length > 1)
        .sort((a, b) => b.breadcrumbs.length - a.breadcrumbs.length);
    for (const collection of collections.slice(0, 4)) {
        const result = await query(
            GetRelatedProductsQuery,
            {
                input: {
                    collectionId: collection.id,
                    groupByProduct: true,
                    take: 5,
                    skip: 0,
                },
            },
            options,
        );
        collect(result.data.search.items);
        if (items.length === 4) break;
    }
    if (items.length) return {items, related: true};
    const result = await query(
        GetRelatedProductsQuery,
        {input: {groupByProduct: true, take: 5, skip: 0}},
        options,
    );
    collect(result.data.search.items);
    return {items, related: false};
}
