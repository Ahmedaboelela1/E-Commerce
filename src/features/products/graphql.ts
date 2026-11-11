import {graphql} from '@/platform/vendure/graphql';

export const ProductCardFragment = graphql(`
    fragment ProductCard on SearchResult {
        productId
        productName
        slug
        productAsset {
            id
            preview
        }
        priceWithTax {
            __typename
            ... on PriceRange {
                min
                max
            }
            ... on SinglePrice {
                value
            }
        }
        currencyCode
    }
`);

export const GetProductDetailQuery = graphql(`
    query GetProductDetail($slug: String!) {
        product(slug: $slug) {
            id
            name
            description
            slug
            featuredAsset {
                id
                preview
                source
            }
            assets {
                id
                preview
                source
            }
            variants {
                id
                name
                sku
                priceWithTax
                stockLevel
                options {
                    id
                    code
                    name
                    groupId
                    group {
                        id
                        code
                        name
                    }
                }
            }
            optionGroups {
                id
                code
                name
                options {
                    id
                    code
                    name
                }
            }
            collections {
                id
                name
                slug
                parent {
                    id
                }
            }
        }
    }
`);

export const GetRelatedProductContextQuery = graphql(`
    query GetRelatedProductContext($id: ID!) {
        product(id: $id) {
            id
            collections { id breadcrumbs { id } }
        }
    }
`);

export const GetRelatedProductsQuery = graphql(`
    query GetRelatedProducts($input: SearchInput!) {
        search(input: $input) { items { ...ProductCard } }
    }
`, [ProductCardFragment]);

export const GetViewedProductQuery = graphql(`
    query GetViewedProduct($id: ID!) {
        product(id: $id) {
            id name slug featuredAsset { preview } variants { priceWithTax }
        }
    }
`);
