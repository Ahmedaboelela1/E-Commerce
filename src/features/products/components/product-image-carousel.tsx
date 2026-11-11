'use client';

import {useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {Button} from '@/components/ui/button';
import {CatalogImage} from '../catalog-image';

export function ProductImageCarousel({
    images,
    name,
}: {
    images: Array<{id: string; preview: string; source: string}>;
    name: string;
}) {
    const t = useTranslations('Product');
    const [index, setIndex] = useState(0);
    const active = images[index] || images[0];
    return (
        <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white sm:rounded-[2rem]">
                <CatalogImage
                    src={active?.preview || active?.source}
                    alt={t('imageAlt', {name, number: index + 1})}
                    sizes="(max-width:1024px) 100vw, 50vw"
                    preload={index === 0}
                    className="p-8 sm:p-12"
                />
                {images.length > 1 && (
                    <>
                        <Button
                            variant="outline"
                            size="icon-lg"
                            aria-label={t('previousImage')}
                            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
                            onClick={() =>
                                setIndex(
                                    (index + images.length - 1) % images.length,
                                )
                            }
                        >
                            <ChevronLeft className="size-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon-lg"
                            aria-label={t('nextImage')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border-slate-200 bg-white text-slate-700 shadow-sm"
                            onClick={() =>
                                setIndex((index + 1) % images.length)
                            }
                        >
                            <ChevronRight className="size-5" />
                        </Button>
                        <span
                            aria-live="polite"
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                            {index + 1} / {images.length}
                        </span>
                    </>
                )}
            </div>
            {images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto p-1">
                    {images.map((image, i) => (
                        <button
                            key={image.id}
                            aria-label={t('chooseImage', {number: i + 1})}
                            aria-pressed={index === i}
                            onClick={() => setIndex(i)}
                            className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${index === i ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                        >
                            <CatalogImage
                                src={image.preview || image.source}
                                alt=""
                                sizes="80px"
                                className="p-2"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
