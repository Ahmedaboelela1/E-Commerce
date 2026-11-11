'use client';
import {useEffect, useState} from 'react';
import {PackagePlus, ShoppingCart} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter, Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Price} from '@/features/pricing/price';
import {CatalogImage} from '@/features/products/catalog-image';
import {loadGrowth, useGrowthWork, GrowthFeedback} from '../growth-client';
import type {ShopBundle} from '../growth-types';

export default function BundlesPage() {
    const t = useTranslations('Growth'),
        locale = useLocale(),
        router = useRouter();
    const [items, setItems] = useState<ShopBundle[]>([]),
        [loading, setLoading] = useState(true),
        [skip, setSkip] = useState(0),
        [total, setTotal] = useState(0);
    const work = useGrowthWork();
    useEffect(() => {
        let active = true;
        setLoading(true);
        void loadGrowth<{shopBundles: {items: ShopBundle[]; total: number}}>(
            'bundles',
            {skip: String(skip)},
            locale,
        )
            .then((d) => {
                if (active) {
                    setItems(d.shopBundles.items);
                    setTotal(d.shopBundles.total);
                }
            })
            .catch(() => {
                if (active) work.setError(t('loadError'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [locale, skip]);
    return (
        <main className="container mx-auto max-w-7xl px-5 pb-16 pt-28">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                <PackagePlus className="size-4" />
                Skillverse Global
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('bundles')}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                {t('bundleHelp')}
            </p>
            <div className="my-5">
                <GrowthFeedback work={work} />
            </div>
            {loading ? (
                <p>{t('loading')}</p>
            ) : !items.length ? (
                <div className="rounded-3xl border border-dashed p-12 text-center">
                    <p className="mb-5 text-muted-foreground">
                        {t('noBundles')}
                    </p>
                    <Button
                        render={<Link href="/search" />}
                        nativeButton={false}
                    >
                        {t('browseProducts')}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {items.map((b) => (
                        <article
                            key={b.id}
                            className="flex flex-col overflow-hidden rounded-3xl border bg-card"
                        >
                            <div className="grid grid-cols-2 gap-2 bg-muted/25 p-5">
                                {b.components.slice(0, 4).map((c) => (
                                    <div
                                        key={c.variantId}
                                        className="relative aspect-[4/3] rounded-xl border bg-white"
                                    >
                                        <CatalogImage
                                            src={c.preview}
                                            alt={c.name}
                                            sizes="240px"
                                            className="p-4"
                                        />
                                        <span className="absolute bottom-2 right-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                            ×{c.quantity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-1 flex-col space-y-4 p-5 sm:p-7">
                                <h2 className="text-xl font-semibold">
                                    {b.name}
                                </h2>
                                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                                    {b.description}
                                </p>
                                <ul className="space-y-2 text-sm">
                                    {b.components.map((c) => (
                                        <li
                                            key={c.variantId}
                                            className="flex items-start justify-between gap-4"
                                        >
                                            <span>{c.name}</span>
                                            <span className="shrink-0 text-muted-foreground">
                                                ×{c.quantity}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-auto border-t pt-4">
                                    <p className="text-2xl font-bold text-primary">
                                        <Price
                                            value={b.price}
                                            currencyCode={b.currencyCode}
                                        />
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {b.pricesIncludeTax
                                            ? t('taxIncluded')
                                            : t('beforeTax')}
                                    </p>
                                    {b.saving > 0 && (
                                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                                            {t('saving')}{' '}
                                            <Price
                                                value={b.saving}
                                                currencyCode={b.currencyCode}
                                            />
                                        </p>
                                    )}
                                    <Button
                                        className="mt-5 h-12 w-full rounded-xl"
                                        disabled={!b.available || work.busy}
                                        onClick={() =>
                                            void work
                                                .run(
                                                    'bundle',
                                                    {id: b.id, quantity: 1},
                                                    'addShopBundle',
                                                )
                                                .then((result) => {
                                                    if (result) {
                                                        work.setMessage(
                                                            t('bundleAdded'),
                                                        );
                                                        router.refresh();
                                                    }
                                                })
                                        }
                                    >
                                        <ShoppingCart className="size-4" />
                                        {b.available
                                            ? t('addBundle')
                                            : t('unavailable')}
                                    </Button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
            {total > 50 && (
                <div className="mt-8 flex gap-3">
                    <Button
                        variant="outline"
                        disabled={!skip}
                        onClick={() => setSkip(Math.max(0, skip - 50))}
                    >
                        {t('previous')}
                    </Button>
                    <Button
                        variant="outline"
                        disabled={skip + 50 >= total}
                        onClick={() => setSkip(skip + 50)}
                    >
                        {t('next')}
                    </Button>
                </div>
            )}
        </main>
    );
}
