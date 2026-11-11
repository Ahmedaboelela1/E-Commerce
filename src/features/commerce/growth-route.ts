import {NextRequest, NextResponse} from 'next/server';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {requestGrowth} from './growth-api';

export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const operation = p.get('operation') || '';
    const locale = p.get('locale') === 'de' ? 'de' : 'en';
    const id = p.get('id') || '';
    const skip = Number(p.get('skip') || 0);
    if (!Number.isInteger(skip) || skip < 0 || skip > 100000)
        return NextResponse.json({error: true}, {status: 400});
    const owner = [
        'preferences',
        'quotes',
        'returns',
        'eligibility',
        'recovery',
    ].includes(operation);
    if (owner && !(await getAuthToken()))
        return NextResponse.json({requiresSignIn: true}, {status: 401});
    try {
        let source = '',
            variables: Record<string, unknown> = {};
        switch (operation) {
            case 'variant':
                if (!/^\d+$/.test(id)) throw new Error();
                source =
                    'query($id:ID!){shopVariantAvailability(variantId:$id)}';
                variables = {id};
                break;
            case 'features':
                source = 'query{shopGrowthFeatures}';
                break;
            case 'content':
                if (!/^\d+$/.test(id)) throw new Error();
                source =
                    'query($id:ID!){shopProductContent(productId:$id) shopGrowthFeatures}';
                variables = {id};
                break;
            case 'compare': {
                const ids = (p.get('ids') || '').split(',').filter(Boolean);
                if (ids.length > 4 || ids.some((i) => !/^\d+$/.test(i)))
                    throw new Error();
                source =
                    'query($ids:[ID!]!){compareShopProducts(productIds:$ids)}';
                variables = {ids};
                break;
            }
            case 'bundles':
                source = 'query($skip:Int){shopBundles(skip:$skip)}';
                variables = {skip};
                break;
            case 'preferences':
                source =
                    'query{myStockWatches myShopMailPreference shopGrowthFeatures}';
                break;
            case 'quotes':
                source = 'query($skip:Int){mySchoolQuotes(skip:$skip)}';
                variables = {skip};
                break;
            case 'returns':
                source = 'query($skip:Int){myReturnRequests(skip:$skip)}';
                variables = {skip};
                break;
            case 'eligibility':
                if (!/^\d+$/.test(id)) throw new Error();
                source = 'query($id:ID!){myReturnEligibility(orderId:$id)}';
                variables = {id};
                break;
            case 'recovery':
                source =
                    'query($token:String!){myRecoveryCart(token:$token) activeOrder{id}}';
                variables = {token: p.get('token') || ''};
                break;
            case 'quoteCatalog':
                source =
                    'query($options:ProductListOptions){products(options:$options){items{id name slug variants{id name sku priceWithTax}}}}';
                variables = {
                    options: {
                        take: 50,
                        filter: p.get('q')
                            ? {name: {contains: p.get('q')}}
                            : undefined,
                    },
                };
                break;
            default:
                return NextResponse.json({error: true}, {status: 400});
        }
        const result = await requestGrowth<Record<string, unknown>>(
            source,
            variables,
            owner,
            locale,
        );
        return NextResponse.json(result.data, {
            headers: {'Cache-Control': 'private, no-store'},
        });
    } catch {
        return NextResponse.json(
            {error: true},
            {status: 503, headers: {'Cache-Control': 'private, no-store'}},
        );
    }
}
