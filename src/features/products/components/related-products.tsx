'use client';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowRight} from 'lucide-react';
import {Link} from '@/platform/i18n/navigation';
import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '../graphql';
import {ProductCard} from './product-card';

type Recommendations = {
    items: Array<FragmentOf<typeof ProductCardFragment>>;
    related: boolean;
};
export function RelatedProducts({
    currentProductId,
}: {
    currentProductId: string;
}) {
    const t = useTranslations('Product');
    const locale = useLocale();
    const [data, setData] = useState<Recommendations | null>(null);
    useEffect(() => {
        const abort = new AbortController();
        void fetch(
            `/api/catalog/related?${new URLSearchParams({productId: currentProductId, locale})}`,
            {signal: abort.signal, cache: 'no-store'},
        )
            .then((r) =>
                r.ok
                    ? r.json()
                    : Promise.reject(new Error('Recommendations unavailable')),
            )
            .then((result) => {
                if (!abort.signal.aborted) setData(result);
            })
            .catch(() => undefined);
        return () => abort.abort();
    }, [currentProductId, locale]);
    if (!data?.items.length) return null;
    return (
        <section
            id="related-products"
            aria-labelledby="related-products-title"
            className="container mx-auto max-w-7xl px-5 pb-16 pt-10 md:pb-20"
        >
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2
                        id="related-products-title"
                        className="text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                        {data.related
                            ? t('relatedProducts')
                            : t('exploreMoreProducts')}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {data.related
                            ? t('relatedProductsIntro')
                            : t('exploreMoreProductsIntro')}
                    </p>
                </div>
                <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                    {t('viewAllProducts')}
                    <ArrowRight className="size-4" />
                </Link>
            </div>
            <div
                className={`grid gap-3 sm:gap-5 ${data.items.length === 1 ? 'max-w-sm grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'}`}
            >
                {data.items.map((item) => (
                    <ProductCard
                        key={readFragment(ProductCardFragment, item).productId}
                        product={item}
                    />
                ))}
            </div>
        </section>
    );
}
