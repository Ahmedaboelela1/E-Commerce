'use client';
import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/platform/i18n/navigation';
import {Button} from '@/components/ui/button';
import {Price} from '@/features/pricing/price';
import {CatalogImage} from '@/features/products/catalog-image';
import {WishlistButton} from '../wishlist';
import {useComparison} from '../comparison';
import {loadGrowth} from '../growth-client';
import type {ComparedProduct} from '../growth-types';

export default function ComparePage() {
    const t = useTranslations('Growth'),
        locale = useLocale();
    const {ids, toggle, clear} = useComparison();
    const [items, setItems] = useState<ComparedProduct[]>([]),
        [error, setError] = useState(false),
        [busy, setBusy] = useState(false);
    const list = ids.join(',');
    useEffect(() => {
        let active = true;
        if (!list) {
            setItems([]);
            return;
        }
        setBusy(true);
        void loadGrowth<{compareShopProducts: ComparedProduct[]}>(
            'compare',
            {ids: list},
            locale,
        )
            .then((d) => {
                if (active) {
                    setItems(d.compareShopProducts);
                    setError(false);
                }
            })
            .catch(() => {
                if (active) setError(true);
            })
            .finally(() => {
                if (active) setBusy(false);
            });
        return () => {
            active = false;
        };
    }, [list, locale]);
    const labels = {
        ageRange: t('ageRange'),
        programming: t('programming'),
        boxContents: t('boxContents'),
        competitions: t('competitions'),
    };
    return (
        <main className="container mx-auto max-w-7xl px-5 pb-16 pt-28">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t('compareTitle')}
                    </h1>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {t('compareHelp')}
                    </p>
                </div>
                {ids.length > 0 && (
                    <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={clear}
                    >
                        {t('clearCompare')}
                    </Button>
                )}
            </div>
            {error && (
                <p role="alert" className="mb-5 text-destructive">
                    {t('loadError')}
                </p>
            )}
            {busy && (
                <p role="status" className="mb-5 text-sm text-muted-foreground">
                    {t('loading')}
                </p>
            )}
            {!ids.length ? (
                <div className="rounded-3xl border border-dashed p-10 text-center">
                    <p className="mb-5 text-muted-foreground">
                        {t('compareEmpty')}
                    </p>
                    <Button
                        render={<Link href="/search" />}
                        nativeButton={false}
                    >
                        {t('browseProducts')}
                    </Button>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                <th className="w-40 min-w-36 border-b bg-muted/30 p-4 text-start">
                                    {t('product')}
                                </th>
                                {items.map((p) => (
                                    <th
                                        key={p.id}
                                        className="w-64 min-w-56 border-b border-l p-5 text-start align-top"
                                    >
                                        <div className="relative mx-auto mb-4 size-40 overflow-hidden sm:size-44 rounded-xl border bg-white">
                                            <CatalogImage
                                                src={p.preview}
                                                alt={p.name}
                                                sizes="240px"
                                                className="p-5"
                                            />
                                        </div>
                                        <Link
                                            href={`/product/${p.slug}`}
                                            className="font-semibold hover:text-primary"
                                        >
                                            {p.name}
                                        </Link>
                                        <div className="mt-4 flex items-center gap-2">
                                            <WishlistButton
                                                productId={String(p.id)}
                                                compact
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    toggle(String(p.id))
                                                }
                                            >
                                                {t('remove')}
                                            </Button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <th className="border-b bg-muted/30 p-4 text-start">
                                    {t('price')}
                                </th>
                                {items.map((p) => (
                                    <td
                                        key={p.id}
                                        className="border-b border-l p-4 align-top font-semibold"
                                    >
                                        {p.minimum != null ? (
                                            <>
                                                <Price
                                                    value={p.minimum}
                                                    currencyCode={
                                                        p.currencyCode
                                                    }
                                                />
                                                {p.maximum !== p.minimum && (
                                                    <>
                                                        {' '}
                                                        –{' '}
                                                        <Price
                                                            value={p.maximum!}
                                                            currencyCode={
                                                                p.currencyCode
                                                            }
                                                        />
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            t('notProvided')
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <th className="border-b bg-muted/30 p-4 text-start">
                                    {t('availability')}
                                </th>
                                {items.map((p) => (
                                    <td
                                        key={p.id}
                                        className="border-b border-l p-4"
                                    >
                                        {p.variants.some((v) => v.available)
                                            ? t('available')
                                            : t('unavailable')}
                                    </td>
                                ))}
                            </tr>
                            {Object.entries(labels).map(([key, label]) => (
                                <tr key={key}>
                                    <th className="border-b bg-muted/30 p-4 text-start align-top">
                                        {label}
                                    </th>
                                    {items.map((p) => (
                                        <td
                                            key={p.id}
                                            className="whitespace-pre-wrap border-b border-l p-4 align-top leading-7"
                                        >
                                            {p.content.specs[
                                                key as keyof typeof labels
                                            ] || t('notProvided')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
