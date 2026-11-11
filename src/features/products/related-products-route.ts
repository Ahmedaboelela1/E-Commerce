import {NextRequest, NextResponse} from 'next/server';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {getRelatedProducts} from './related-products-data';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('productId') || '';
    const locale =
        request.nextUrl.searchParams.get('locale') === 'de' ? 'de' : 'en';
    const headers = {'Cache-Control': 'private, no-store'};
    if (!/^[1-9]\d{0,15}$/.test(id))
        return NextResponse.json({error: true}, {status: 400, headers});
    try {
        const result = await getRelatedProducts(
            id,
            locale,
            await getActiveCurrencyCode(),
        );
        return result
            ? NextResponse.json(result, {headers})
            : NextResponse.json({error: true}, {status: 404, headers});
    } catch {
        return NextResponse.json({error: true}, {status: 503, headers});
    }
}
