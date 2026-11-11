import {Suspense} from 'react';
import {getRouteLocale} from '@/platform/i18n/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {FacetFilters} from '@/features/search/facet-filters';
import {ProductGridSkeleton} from '@/features/products/product-grid-skeleton';
import {ProductGrid} from '@/features/products/product-grid';
import {getCurrentPage} from '@/features/search/search-helpers';
import {getCatalogData} from '@/features/search/data';
import {CatalogSearch} from '@/features/search/catalog-search';

interface SearchResultsProps {
    searchParams: Promise<{
        page?: string;
    }>;
}

export async function SearchResults({searchParams}: SearchResultsProps) {
    const searchParamsResolved = await searchParams;
    const locale = await getRouteLocale();
    const currencyCode = await getActiveCurrencyCode();
    const page = getCurrentPage(searchParamsResolved);

    const {productDataPromise, facetDataPromise, collectionsPromise} =
        await getCatalogData(searchParamsResolved, locale, currencyCode);

    return (
        <>
            <CatalogSearch />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <aside className="lg:col-span-1">
                    <Suspense
                        fallback={
                            <div className="h-64 animate-pulse bg-muted rounded-lg" />
                        }
                    >
                        <FacetFilters
                            productDataPromise={facetDataPromise}
                            collectionsPromise={collectionsPromise}
                        />
                    </Suspense>
                </aside>

                {/* Product Grid */}
                <div className="lg:col-span-3">
                    <Suspense fallback={<ProductGridSkeleton />}>
                        <ProductGrid
                            productDataPromise={productDataPromise}
                            currentPage={page}
                            take={12}
                        />
                    </Suspense>
                </div>
            </div>
        </>
    );
}
