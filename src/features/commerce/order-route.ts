import {NextRequest, NextResponse} from 'next/server';
import {query} from '@/platform/vendure/api';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {OrderInfo} from './graphql';

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('orderId') || '';
    if (!/^\d+$/.test(id))
        return NextResponse.json({error: true}, {status: 400});
    if (!(await getAuthToken()))
        return NextResponse.json({error: true}, {status: 401});
    try {
        const result = await query(OrderInfo, {id}, {useAuthToken: true});
        return NextResponse.json(result.data.myOrderOperations, {
            headers: {'Cache-Control': 'private, no-store'},
        });
    } catch {
        return NextResponse.json({error: true}, {status: 404});
    }
}
