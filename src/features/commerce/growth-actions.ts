'use server';
import {getLocale} from 'next-intl/server';
import {updateTag} from 'next/cache';
import {getAuthToken, setAuthToken} from '@/platform/vendure/auth-token';
import {requestGrowth} from './growth-api';

export async function growthAction(
    action: string,
    input: Record<string, unknown>,
): Promise<{
    data?: Record<string, unknown>;
    error?: boolean;
    requiresSignIn?: boolean;
}> {
    if (action !== 'unsubscribe' && !(await getAuthToken()))
        return {requiresSignIn: true};
    let source = '',
        variables = input;
    switch (action) {
        case 'bundle':
            source =
                'mutation($id:ID!,$quantity:Int!){addShopBundle(bundleId:$id,quantity:$quantity)}';
            break;
        case 'stock':
            source =
                'mutation($id:ID!,$active:Boolean!){setShopStockWatch(variantId:$id,active:$active)}';
            break;
        case 'consent':
            source =
                'mutation($consent:Boolean!){setShopCartReminderConsent(consent:$consent)}';
            break;
        case 'quote':
            source = 'mutation($input:JSON!){requestSchoolQuote(input:$input)}';
            variables = {input};
            break;
        case 'quoteResponse':
            source =
                'mutation($id:ID!,$accept:Boolean!,$version:Int!){respondToSchoolQuote(quoteId:$id,accept:$accept,version:$version)}';
            break;
        case 'return':
            source =
                'mutation($id:ID!,$input:JSON!){requestShopReturn(orderId:$id,input:$input)}';
            break;
        case 'returnPhoto':
            source =
                'query($id:ID!,$index:Int!){myReturnPhoto(returnId:$id,index:$index)}';
            break;
        case 'unsubscribe':
            source =
                'mutation($kind:String!,$id:ID!,$token:String!){unsubscribeShopMail(kind:$kind,id:$id,token:$token)}';
            break;
        default:
            return {error: true};
    }
    try {
        const result = await requestGrowth<Record<string, unknown>>(
            source,
            variables,
            action !== 'unsubscribe',
            await getLocale(),
        );
        if (result.token) await setAuthToken(result.token);
        if (action === 'bundle') {
            updateTag('cart');
            updateTag('active-order');
        }
        return {data: result.data};
    } catch {
        return {error: true};
    }
}
export async function uploadReturnPhoto(
    form: FormData,
): Promise<{
    data?: Record<string, unknown>;
    error?: boolean;
    requiresSignIn?: boolean;
}> {
    const token = await getAuthToken();
    if (!token) return {requiresSignIn: true};
    const file = form.get('photo');
    const id = String(form.get('returnId') || '');
    if (
        !/^\d+$/.test(id) ||
        !file ||
        typeof file === 'string' ||
        !file.size ||
        file.size > 5 * 1024 * 1024 ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    )
        return {error: true};
    const endpoint =
        process.env.VENDURE_SHOP_API_URL ||
        process.env.NEXT_PUBLIC_VENDURE_SHOP_API_URL;
    if (!endpoint) return {error: true};
    const data = new FormData();
    data.set(
        'operations',
        JSON.stringify({
            query: 'mutation($id:ID!,$file:Upload!){uploadShopReturnPhoto(returnId:$id,file:$file)}',
            variables: {id, file: null},
        }),
    );
    data.set('map', JSON.stringify({'0': ['variables.file']}));
    data.set('0', file);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                [process.env.VENDURE_CHANNEL_TOKEN_HEADER || 'vendure-token']:
                    process.env.VENDURE_CHANNEL_TOKEN ||
                    process.env.NEXT_PUBLIC_VENDURE_CHANNEL_TOKEN ||
                    '__default_channel__',
                'Apollo-Require-Preflight': 'true',
            },
            body: data,
            cache: 'no-store',
            signal: AbortSignal.timeout(45000),
        });
        const result = await response.json();
        if (!response.ok || result.errors) return {error: true};
        return {data: result.data};
    } catch {
        return {error: true};
    }
}
