'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/platform/i18n/navigation';
import {ArrowRight} from 'lucide-react';
import {FragmentOf} from '@/platform/vendure/graphql';
import {ProductCardFragment} from './graphql';
import {ProductCard} from './components/product-card';
import {Button} from '@/components/ui/button';

export function FeaturedProducts() {
    const t = useTranslations('Product');
    const locale = useLocale();
    const [products, setProducts] = useState<Array<
        FragmentOf<typeof ProductCardFragment>
    > | null>(null);
    const [error, setError] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const abort = new AbortController();
        void fetch(`/api/catalog?locale=${encodeURIComponent(locale)}`, {
            signal: abort.signal,
        })
            .then((r) =>
                r.ok
                    ? r.json()
                    : Promise.reject(new Error('Catalog unavailable')),
            )
            .then((data) => {
                setProducts(data.items);
                setError(false);
            })
            .catch(() => {
                if (!abort.signal.aborted) setError(true);
            });
        return () => abort.abort();
    }, [locale, attempt]);
    return (
        <section
            id="products"
            className="container mx-auto max-w-7xl px-5 py-12 md:py-20"
        >
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        {t('catalogEyebrow')}
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {t('featuredProducts')}
                    </h2>
                    <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                        {t('catalogIntro')}
                    </p>
                </div>
                <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
                >
                    {t('viewAllProducts')}
                    <ArrowRight className="size-4" />
                </Link>
            </div>
            {error ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                    <p
                        role="alert"
                        className="mb-4 text-sm text-muted-foreground"
                    >
                        {t('catalogError')}
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setError(false);
                            setAttempt((v) => v + 1);
                        }}
                    >
                        {t('retryCatalog')}
                    </Button>
                </div>
            ) : products === null ? (
                <div
                    aria-busy="true"
                    className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
                >
                    {Array.from({length: 4}, (_, i) => (
                        <div
                            key={i}
                            className="aspect-[3/4] animate-pulse rounded-2xl bg-muted"
                        />
                    ))}
                </div>
            ) : products.length ? (
                <div
                    className={`grid items-stretch gap-3 sm:gap-5 ${products.length === 1 ? 'mx-auto max-w-sm grid-cols-1' : products.length === 2 ? 'mx-auto max-w-3xl grid-cols-2' : products.length === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
                >
                    {products.map((product, index) => (
                        <ProductCard key={index} product={product} />
                    ))}
                </div>
            ) : (
                <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                    {t('noProductsFound')}
                </p>
            )}
        </section>
    );
}
