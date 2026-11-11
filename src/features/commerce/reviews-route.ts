import {NextRequest, NextResponse} from 'next/server';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {query} from '@/platform/vendure/api';
import {PublicReviews, OwnReview} from './graphql';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('productId') || '';
    const skip = Number(request.nextUrl.searchParams.get('skip') || 0);
    if (
        !/^\d+$/.test(id) ||
        !Number.isInteger(skip) ||
        skip < 0 ||
        skip > 10000
    )
        return NextResponse.json({error: true}, {status: 400});
    try {
        const publicResult = await query(PublicReviews, {id, skip});
        const authenticated = !!(await getAuthToken());
        const own = authenticated
            ? await query(OwnReview, {id}, {useAuthToken: true})
            : null;
        return NextResponse.json(
            {
                reviews: publicResult.data.productReviews,
                own: own?.data.myProductReview || null,
                authenticated,
            },
            {headers: {'Cache-Control': 'private, no-store'}},
        );
    } catch {
        return NextResponse.json({error: true}, {status: 503});
    }
}
