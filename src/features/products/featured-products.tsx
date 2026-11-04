import {ProductCarousel} from "@/features/products/components/product-carousel";
import {getRouteLocale} from "@/platform/i18n/server";
import {cacheLife, cacheTag} from "next/cache";
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {query} from "@/platform/vendure/api";
import {SearchProductsQuery} from '@/features/search/graphql';
import { Link } from '@/platform/i18n/navigation';
import {ArrowRight} from "lucide-react";
import {getTranslations} from 'next-intl/server';
import {preconnect} from 'react-dom';
import {readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

function getAssetOrigin(preview?: string) {
    if (!preview) return undefined;

    try {
        return new URL(preview).origin;
    } catch {
        return undefined;
    }
}

async function getFeaturedCollectionProducts(currencyCode: string) {
    'use cache'
    cacheLife('minutes')

    const locale = await getRouteLocale();
    cacheTag(`featured-${locale}-${currencyCode}`);
    cacheTag('products');

    // The Egypt channel is new and does not yet have an 'electronics'
    // collection. Display available catalog items regardless of collection.
    const result = await query(SearchProductsQuery, {
        input: {
            take: 12,
            skip: 0,
            groupByProduct: true,
        },
    }, {languageCode: locale, currencyCode});

    return result.data.search.items;
}


export async function FeaturedProducts() {
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const t = await getTranslations({locale, namespace: 'Product'});
    const products = await getFeaturedCollectionProducts(currencyCode);
    const firstProduct = products[0]
        ? readFragment(ProductCardFragment, products[0])
        : undefined;
    const assetOrigin = getAssetOrigin(firstProduct?.productAsset?.preview);

    if (assetOrigin) {
        preconnect(assetOrigin);
    }

    return (
        <div>
            <ProductCarousel
                title={t('featuredProducts')}
                products={products}
                preloadFirstProduct
            />
            <div className="container mx-auto px-4 -mt-6 mb-8">
                <div className="flex justify-center">
                    <Link
                        href="/search"
                        className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4 transition-colors"
                    >
                        {t('viewAllProducts')}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </div>
        </div>
    )
}
