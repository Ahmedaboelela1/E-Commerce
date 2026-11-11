import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '../graphql';
import {ProductTile} from '../product-tile';

export function ProductCard({
    product: fragment,
    preload,
}: {
    product: FragmentOf<typeof ProductCardFragment>;
    preload?: boolean;
}) {
    const product = readFragment(ProductCardFragment, fragment);
    const price = product.priceWithTax;
    const minimum =
        price.__typename === 'PriceRange'
            ? price.min
            : price.__typename === 'SinglePrice'
              ? price.value
              : null;
    const maximum = price.__typename === 'PriceRange' ? price.max : minimum;
    return (
        <ProductTile
            product={{
                id: product.productId,
                name: product.productName,
                slug: product.slug,
                preview: product.productAsset?.preview,
                minimum,
                maximum,
                currencyCode: product.currencyCode,
            }}
            preload={preload}
        />
    );
}
