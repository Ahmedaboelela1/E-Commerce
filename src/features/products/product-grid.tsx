import {ShopLinks} from '@/features/commerce/shop-menu';
import {ResultOf} from '@/platform/vendure/graphql';
import {ProductCard} from './components/product-card';
import {Pagination} from './components/pagination';
import {SortDropdown} from '@/features/search/sort-dropdown';
import {SearchProductsQuery} from '@/features/search/graphql';
import {getRouteLocale} from '@/platform/i18n/server';
import {getTranslations} from 'next-intl/server';

interface ProductGridProps {
    productDataPromise: Promise<{
        data: ResultOf<typeof SearchProductsQuery>;
        token?: string;
    }>;
    currentPage: number;
    take: number;
}

export async function ProductGrid({
    productDataPromise,
    currentPage,
    take,
}: ProductGridProps) {
    const locale = await getRouteLocale();
    const t = await getTranslations({locale, namespace: 'Product'});
    const result = await productDataPromise;

    const searchResult = result.data.search;
    const totalPages = Math.ceil(searchResult.totalItems / take);


    return (
        <div className="space-y-6"><ShopLinks/>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                    {t('productCount', {count: searchResult.totalItems})}
                </p>
                <SortDropdown />
            </div>

            {!searchResult.items.length?<div className="rounded-2xl border border-dashed bg-muted/20 py-16 text-center"><p className="text-muted-foreground">{t('noProductsFound')}</p></div>:<div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 lg:grid-cols-3">
                {searchResult.items.map((product, i) => (
                    <ProductCard
                        key={'product-grid-item' + i}
                        product={product}
                    />
                ))}
            </div>}

            {totalPages > 1 && (
                <Pagination currentPage={currentPage} totalPages={totalPages} />
            )}
        </div>
    );
}
