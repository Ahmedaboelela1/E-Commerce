import {Suspense} from 'react';
import {ArrowRight, Heart, MoveUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Link} from '@/platform/i18n/navigation';
import {getTranslations} from 'next-intl/server';
import {ProductSpotlight} from '@/features/products/spotlight';

export async function HeroSection() {
    const t = await getTranslations('Hero');
    return (
        <section className="relative overflow-hidden border-b border-border/60 bg-[#f0f5fc] pt-16 dark:bg-[#13243e]">
            <div
                className="pointer-events-none absolute -end-48 -top-24 size-[38rem] rounded-full border-[80px] border-[#dae7fa]/60 dark:border-[#203b62]/40"
                aria-hidden="true"
            />
            <div className="container relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 md:grid-cols-2 md:gap-12 md:py-20 lg:py-24">
                <div className="max-w-xl space-y-7">
                    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                        <span className="h-px w-8 bg-primary" />
                        {t('eyebrow')}
                    </p>
                    <h1 className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
                        {t('title')}
                        <span className="mt-1 block text-primary">
                            {t('titleHighlight')}
                        </span>
                    </h1>
                    <p className="max-w-lg text-base leading-8 text-muted-foreground sm:text-lg">
                        {t('subtitle')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            render={<Link href="/search" />}
                            nativeButton={false}
                            size="lg"
                            className="h-12 rounded-full px-6 font-semibold"
                        >
                            {t('shopNow')}
                            <ArrowRight className="ms-2 size-4" />
                        </Button>
                        <Button
                            render={<Link href="/account/wishlist" />}
                            nativeButton={false}
                            variant="outline"
                            size="lg"
                            className="h-12 rounded-full border-primary/20 bg-transparent px-5"
                        >
                            <Heart className="size-4" />
                            {t('savedProducts')}
                        </Button>
                    </div>
                    <p className="flex items-center gap-2 pt-1 text-xs leading-6 text-muted-foreground">
                        <MoveUpRight className="size-3.5 shrink-0" />
                        {t('helper')}
                    </p>
                </div>
                <div className="relative mx-auto w-full max-w-lg">
                    <Suspense
                        fallback={
                            <div className="aspect-square animate-pulse rounded-[2rem] border border-white/60 bg-white/50" />
                        }
                    >
                        <ProductSpotlight />
                    </Suspense>
                </div>
            </div>
        </section>
    );
}
