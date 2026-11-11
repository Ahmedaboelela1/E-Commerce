import {NextRequest, NextResponse} from 'next/server';
import {query} from '@/platform/vendure/api';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';
import {SearchProductsQuery} from '@/features/search/graphql';

export async function GET(request: NextRequest) {
    const locale =
        request.nextUrl.searchParams.get('locale') === 'de' ? 'de' : 'en';
    try {
        const currencyCode = await getActiveCurrencyCode();
        const result = await query(
            SearchProductsQuery,
            {input: {take: 12, skip: 0, groupByProduct: true}},
            {languageCode: locale, currencyCode},
        );
        return NextResponse.json(
            {items: result.data.search.items},
            {headers: {'Cache-Control': 'private, no-store'}},
        );
    } catch {
        return NextResponse.json({error: true}, {status: 503});
    }
}
