import {WishlistButton} from '@/features/commerce/wishlist';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/platform/i18n/navigation';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {Price} from '@/features/pricing/price';
import {readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from './graphql';
import {getFeaturedCatalogProducts} from './catalog-data';
import {CatalogImage} from './catalog-image';

export async function ProductSpotlight() {
    const currency = await getActiveCurrencyCode();
    const [items, t] = await Promise.all([
        getFeaturedCatalogProducts(currency),
        getTranslations('Product'),
    ]);
    if (!items.length) return null;
    const product = readFragment(ProductCardFragment, items[0]);
    const price = product.priceWithTax;
    const minimum =
        price.__typename === 'PriceRange'
            ? price.min
            : price.__typename === 'SinglePrice'
              ? price.value
              : null;
    return (
        <div className="relative">
            <Link
                href={`/product/${product.slug}`}
                className="group relative block rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-2xl shadow-[#102140]/10 backdrop-blur-sm sm:p-6 dark:border-slate-600 dark:bg-slate-800/80"
            >
                <div className="flex items-center justify-between px-1 pb-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {t('spotlight')}
                    </span>
                </div>
                <div className="relative mx-auto aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white">
                    <CatalogImage
                        src={product.productAsset?.preview}
                        alt={product.productName}
                        preload
                        sizes="(max-width: 768px) 90vw, 40vw"
                        className="p-6 transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3 px-1 pt-5">
                    <h2 className="max-w-xs text-lg font-semibold leading-snug">
                        {product.productName}
                    </h2>
                    {minimum != null && (
                        <span className="text-lg font-bold text-primary">
                            <Price
                                value={minimum}
                                currencyCode={product.currencyCode}
                            />
                        </span>
                    )}
                </div>
            </Link>
            <div className="absolute right-5 top-4 sm:right-6 sm:top-5">
                <WishlistButton productId={product.productId} compact />
            </div>
        </div>
    );
}
