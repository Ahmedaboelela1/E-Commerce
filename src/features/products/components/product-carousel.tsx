'use client';

import {ProductCard} from '@/features/products/components/product-card';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from '@/components/ui/carousel';
import {FragmentOf, readFragment} from '@/platform/vendure/graphql';
import {ProductCardFragment} from '@/features/products/graphql';

interface ProductCarouselClientProps {
    title: string;
    products: Array<FragmentOf<typeof ProductCardFragment>>;
    preloadFirstProduct?: boolean;
}

export function ProductCarousel({
    title,
    products,
    preloadFirstProduct,
}: ProductCarouselClientProps) {
    return (
        <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl md:text-4xl font-bold mb-8">{title}</h2>
                <Carousel
                    opts={{
                        align: 'start',
                        loop: false,
                    }}
                    className="w-full"
                >
                    <CarouselContent className="-ml-2 md:-ml-4">
                        {products.map((product, index) => (
                            <CarouselItem
                                key={
                                    readFragment(ProductCardFragment, product)
                                        .productId
                                }
                                className="pl-2 md:pl-4 basis-1/2 lg:basis-1/3 xl:basis-1/4"
                            >
                                <ProductCard
                                    product={product}
                                    preload={preloadFirstProduct && index === 0}
                                />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    <div className="mt-5 flex justify-end gap-2">
                        <CarouselPrevious className="static hidden translate-y-0 rounded-full md:inline-flex" />
                        <CarouselNext className="static hidden translate-y-0 rounded-full md:inline-flex" />
                    </div>
                </Carousel>
            </div>
        </section>
    );
}
