'use client';
import {CompareButton} from '@/features/commerce/comparison';

import {ArrowUpRight, PackageOpen} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Suspense} from 'react';
import {Link} from '@/platform/i18n/navigation';
import {Price} from '@/features/pricing/price';
import {WishlistButton} from '@/features/commerce/wishlist';
import {CatalogImage} from './catalog-image';

export interface ProductTileData {
    id: string;
    name: string;
    slug: string;
    preview?: string | null;
    minimum?: number | null;
    maximum?: number | null;
    currencyCode: string;
}

export function ProductTile({
    product,
    preload = false,
}: {
    product: ProductTileData;
    preload?: boolean;
}) {
    const t = useTranslations('Product');
    return (
        <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 motion-reduce:transform-none">
            <Link
                href={`/product/${product.slug}`}
                className="flex h-full flex-col rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
                <div className="relative m-2 aspect-square overflow-hidden rounded-xl border border-slate-100 bg-white sm:m-3">
                    <CatalogImage
                        src={product.preview}
                        alt={product.name}
                        preload={preload}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="p-5 transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
                    />
                </div>
                <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                    <h3 className="line-clamp-2 min-h-11 text-sm font-semibold leading-relaxed text-foreground transition-colors group-hover:text-primary sm:text-base">
                        {product.name}
                    </h3>
                    <div className="mt-auto">
                        {product.minimum != null ? (
                            <Suspense
                                fallback={
                                    <div className="h-7 w-24 animate-pulse rounded bg-muted" />
                                }
                            >
                                <p className="flex flex-wrap items-baseline gap-x-1.5 text-base font-bold tracking-tight sm:text-xl">
                                    {product.maximum !== product.minimum && (
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {t('from')}
                                        </span>
                                    )}
                                    <Price
                                        value={product.minimum}
                                        currencyCode={product.currencyCode}
                                    />
                                </p>
                            </Suspense>
                        ) : (
                            <PackageOpen
                                className="size-5 text-muted-foreground"
                                aria-hidden="true"
                            />
                        )}
                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs font-medium text-muted-foreground sm:text-sm">
                            <span>{t('viewProduct')}</span>
                            <ArrowUpRight
                                className="size-4 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                        </div>
                    </div>
                </div>
            </Link>
            <div className="px-3 pb-3"><CompareButton productId={product.id}/></div>
            <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
                <WishlistButton productId={product.id} compact />
            </div>
        </article>
    );
}
