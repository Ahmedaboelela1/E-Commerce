'use client';

import Image from 'next/image';
import {useState} from 'react';
import {PackageOpen} from 'lucide-react';
import {useTranslations} from 'next-intl';

export function CatalogImage({
    src,
    alt,
    sizes,
    className = '',
    preload = false,
}: {
    src?: string | null;
    alt: string;
    sizes: string;
    className?: string;
    preload?: boolean;
}) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const t = useTranslations('Product');
    if (!src || failedSrc === src)
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-slate-400">
                <PackageOpen className="size-10 stroke-1" aria-hidden="true" />
                <span className="text-xs">{t('noImage')}</span>
            </div>
        );
    return (
        <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            preload={preload}
            className={`object-contain ${className}`}
            onError={() => setFailedSrc(src)}
        />
    );
}
