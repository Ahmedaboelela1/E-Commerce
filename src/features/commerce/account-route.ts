import {NextResponse} from 'next/server';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {query} from '@/platform/vendure/api';
import {WishlistIds} from './graphql';

export async function GET() {
    if (!(await getAuthToken()))
        return NextResponse.json(
            {authenticated: false, ids: []},
            {headers: {'Cache-Control': 'private, no-store'}},
        );
    try {
        const result = await query(WishlistIds, undefined, {
            useAuthToken: true,
        });
        return NextResponse.json(
            {authenticated: true, ids: result.data.myWishlistIds},
            {headers: {'Cache-Control': 'private, no-store'}},
        );
    } catch {
        return NextResponse.json(
            {error: true},
            {status: 503, headers: {'Cache-Control': 'private, no-store'}},
        );
    }
}
