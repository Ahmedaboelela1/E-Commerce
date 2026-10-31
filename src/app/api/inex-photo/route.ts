import {NextRequest, NextResponse} from 'next/server';
import {egyptCatalogProducts} from '@/site/home/egypt-catalog';

export const runtime = 'nodejs';

function metadataImage(html: string): string | undefined {
    const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
    for (const propertyName of ['og:image', 'twitter:image']) {
        for (const tag of metaTags) {
            if (!new RegExp(`(?:property|name)=["']${propertyName}["']`, 'i').test(tag)) continue;
            const match = tag.match(/content=["']([^"']+)["']/i);
            if (match?.[1]) return match[1];
        }
    }
    const galleryImage = html.match(/data-large_image=["']([^"']+)["']/i)
        ?? html.match(/<img[^>]+(?:src|data-src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))[^"']*["']/i);
    return galleryImage?.[1];
}

function safeInexImage(value: string | undefined): string | undefined {
    if (!value) return;
    try {
        const decoded = value.replace(/&amp;/g, '&').replace(/&#038;/g, '&');
        const url = new URL(decoded);
        if (url.protocol !== 'https:' || !['inex.co.th', 'www.inex.co.th'].includes(url.hostname)) return;
        return url.toString();
    } catch {
        return;
    }
}

export async function GET(request: NextRequest) {
    const sku = request.nextUrl.searchParams.get('sku');
    const product = egyptCatalogProducts.find((entry) => entry.sku === sku);
    if (!product) return NextResponse.json({error: 'Unknown product'}, {status: 404});

    try {
        // Resolve the public product photo from the *official INEX product page*.
        // Do not proxy arbitrary URLs or accept a user-controlled origin.
        const response = await fetch(product.supplierUrl, {
            next: {revalidate: 86400},
            signal: AbortSignal.timeout(9000),
            headers: {'Accept': 'text/html'},
        });
        if (!response.ok) throw new Error('Supplier page unavailable');
        const html = await response.text();
        const imageUrl = safeInexImage(metadataImage(html));
        if (!imageUrl) throw new Error('No official image metadata');
        return NextResponse.redirect(imageUrl, {
            status: 302,
            headers: {'Cache-Control': 'public, max-age=3600, s-maxage=86400'},
        });
    } catch {
        // The supplier can change its HTML or block remote requests.
        // Keep storefront rendering safe and show a branded fallback image.
        return NextResponse.redirect(new URL('/inex-image-fallback.svg', request.url), {
            status: 302,
            headers: {'Cache-Control': 'public, max-age=300'},
        });
    }
}
