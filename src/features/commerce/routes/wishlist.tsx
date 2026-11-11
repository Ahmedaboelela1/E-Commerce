import {getTranslations} from 'next-intl/server';
import {Suspense} from 'react';
import {Heart, ArrowRight} from 'lucide-react';
import {getActiveCustomer} from '@/features/account/customer';
import {redirect, Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {query} from '@/platform/vendure/api';
import {ProductTile} from '@/features/products/product-tile';
import {WishlistProducts} from '../graphql';

export default function WishlistPage() {
    return (
        <Suspense
            fallback={
                <div className="h-48 animate-pulse rounded-xl bg-muted" />
            }
        >
            <WishlistContent />
        </Suspense>
    );
}
async function WishlistContent() {
    const locale = await getRouteLocale();
    const customer = await getActiveCustomer();
    if (!customer)
        return redirect({
            href: '/sign-in?redirectTo=/account/wishlist',
            locale,
        });
    const t = await getTranslations('Commerce');
    const {data} = await query(WishlistProducts, undefined, {
        useAuthToken: true,
    });
    return (
        <div className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-rose-600">
                        <Heart className="size-4" />
                        {t('savedForLater')}
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t('wishlist')}
                    </h1>
                </div>
                <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
                >
                    {t('continueBrowsing')}
                    <ArrowRight className="size-4" />
                </Link>
            </div>
            {!data.myWishlistProducts.length && (
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-muted/30 px-5 py-16 text-center">
                    <Heart className="size-12 stroke-1 text-rose-300" />
                    <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                        {t('wishlistEmpty')}
                    </p>
                    <Link
                        href="/search"
                        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
                    >
                        {t('continueBrowsing')}
                    </Link>
                </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                {data.myWishlistProducts.map((product) => {
                    const prices = product.variants.map((v) => v.priceWithTax);
                    const minimum = prices.length ? Math.min(...prices) : null;
                    return (
                        <ProductTile
                            key={product.id}
                            product={{
                                id: product.id,
                                name: product.name,
                                slug: product.slug,
                                preview: product.featuredAsset?.preview,
                                minimum,
                                maximum: prices.length
                                    ? Math.max(...prices)
                                    : null,
                                currencyCode:
                                    product.variants[0]?.currencyCode || 'EGP',
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
