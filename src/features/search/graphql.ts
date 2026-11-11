import {graphql} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

export const SearchProductsQuery = graphql(`
    query SearchProducts($input: SearchInput!) {
        search(input: $input) {
            totalItems
            items {
                ...ProductCard
            }
            facetValues {
                count
                facetValue {
                    id
                    name
                    facet {
                        id
                        name
                    }
                }
            }
        }
    }
`, [ProductCardFragment]);

export const GetFilterCollectionsQuery = graphql(`
    query GetFilterCollections($options: CollectionListOptions) {
        collections(options: $options) {
            totalItems
            items { id name slug breadcrumbs { id name } }
        }
    }
`);
