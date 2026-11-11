import {NextRequest, NextResponse} from 'next/server';
import {query} from '@/platform/vendure/api';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {GetViewedProductQuery} from './graphql';
import {RECENT_LIMIT} from './recent-history';

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams,
        ids = (params.get('ids') || '').split(',').filter(Boolean);
    const headers = {'Cache-Control': 'private, no-store'};
    if (
        ids.length > RECENT_LIMIT ||
        ids.some((id) => !/^[1-9]\d{0,15}$/.test(id))
    )
        return NextResponse.json({error: true}, {status: 400, headers});
    try {
        const currencyCode = await getActiveCurrencyCode(),
            languageCode = params.get('locale') === 'de' ? 'de' : 'en';
        const products = await Promise.all(
            [...new Set(ids)].map(async (id) => {
                const {data} = await query(
                    GetViewedProductQuery,
                    {id},
                    {languageCode, currencyCode, fetch: {cache: 'no-store'}},
                );
                const p = data.product;
                if (!p || !p.variants.length) return null;
                const prices = p.variants.map((v) => v.priceWithTax);
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    preview: p.featuredAsset?.preview || null,
                    minimum: Math.min(...prices),
                    maximum: Math.max(...prices),
                    currencyCode,
                };
            }),
        );
        return NextResponse.json(
            {items: products.filter((p) => p !== null).slice(0, 8)},
            {headers},
        );
    } catch {
        return NextResponse.json({error: true}, {status: 503, headers});
    }
}
