import {getTranslations} from 'next-intl/server';
import {Suspense} from 'react';
import Image from 'next/image';
import {getActiveCustomer} from '@/features/account/customer';
import {redirect, Link} from '@/platform/i18n/navigation';
import {getRouteLocale} from '@/platform/i18n/server';
import {query} from '@/platform/vendure/api';
import {Price} from '@/features/pricing/price';
import {WishlistProducts} from '../graphql';
import {WishlistButton} from '../wishlist';

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
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">{t('wishlist')}</h1>
            {!data.myWishlistProducts.length && (
                <p className="text-muted-foreground">{t('wishlistEmpty')}</p>
            )}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.myWishlistProducts.map((product) => {
                    const prices = product.variants.map((v) => v.priceWithTax);
                    const min = prices.length ? Math.min(...prices) : null;
                    const max = prices.length ? Math.max(...prices) : null;
                    return (
                        <article
                            className="overflow-hidden rounded-xl border"
                            key={product.id}
                        >
                            <Link
                                href={`/product/${product.slug}`}
                                className="block"
                            >
                                <div className="relative aspect-square bg-muted">
                                    {product.featuredAsset && (
                                        <Image
                                            src={product.featuredAsset.preview}
                                            alt={product.name}
                                            fill
                                            sizes="(max-width:640px) 100vw, 33vw"
                                            className="object-cover"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2 p-4">
                                    <h2 className="font-semibold">
                                        {product.name}
                                    </h2>
                                    {min !== null && (
                                        <p>
                                            <Price
                                                value={min}
                                                currencyCode={
                                                    product.variants[0]
                                                        .currencyCode
                                                }
                                            />
                                            {max !== min && (
                                                <>
                                                    {' '}
                                                    –{' '}
                                                    <Price
                                                        value={max!}
                                                        currencyCode={
                                                            product.variants[0]
                                                                .currencyCode
                                                        }
                                                    />
                                                </>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </Link>
                            <div className="p-4 pt-0">
                                <WishlistButton productId={product.id} />
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
