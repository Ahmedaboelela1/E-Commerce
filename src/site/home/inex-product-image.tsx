'use client';

import Image from 'next/image';
import {useState} from 'react';

export function InexProductImage({sku, name, className = ''}: {
    sku: string;
    name: string;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    return (
        <Image
            src={failed ? '/inex-image-fallback.svg' : `/api/inex-photo?sku=${encodeURIComponent(sku)}`}
            alt={`${name} — INEX manufacturer product photo`}
            width={800}
            height={600}
            unoptimized
            onError={() => setFailed(true)}
            className={className}
        />
    );
}
