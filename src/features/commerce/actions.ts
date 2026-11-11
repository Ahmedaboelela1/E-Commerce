'use server';

import {query, mutate} from '@/platform/vendure/api';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {
    OrderInvoice,
    SubmitReview,
    ToggleWishlist,
    type OrderOperationsInfo,
} from './graphql';

export async function toggleSavedProduct(id: string) {
    if (!(await getAuthToken())) return {requiresSignIn: true};
    try {
        const result = await mutate(ToggleWishlist, {id}, {useAuthToken: true});
        return {ids: result.data.toggleWishlist};
    } catch {
        return {error: true};
    }
}

export async function submitReview(id: string, rating: number, text: string) {
    if (!(await getAuthToken())) return {error: true};
    try {
        const result = await mutate(
            SubmitReview,
            {id, rating, text},
            {useAuthToken: true},
        );
        return {review: result.data.submitProductReview};
    } catch {
        return {error: true};
    }
}

export async function getOrderInvoice(id: string) {
    if (!(await getAuthToken())) return {error: true};
    try {
        const result = await query(OrderInvoice, {id}, {useAuthToken: true});
        return {file: result.data.myOrderInvoice};
    } catch {
        return {error: true};
    }
}

export async function uploadTransferProof(
    form: FormData,
): Promise<{info?: OrderOperationsInfo; error?: boolean}> {
    const token = await getAuthToken();
    if (!token) return {error: true};
    const id = String(form.get('orderId') || '');
    const reference = String(form.get('reference') || '').trim();
    const file = form.get('receipt');
    const hasFile = !!file && typeof file !== 'string' && file.size > 0;
    if (!/^\d+$/.test(id) || reference.length > 120 || (!reference && !hasFile))
        return {error: true};
    if (
        hasFile &&
        (file.size > 5 * 1024 * 1024 ||
            !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    )
        return {error: true};
    const endpoint =
        process.env.VENDURE_SHOP_API_URL ||
        process.env.NEXT_PUBLIC_VENDURE_SHOP_API_URL;
    if (!endpoint) return {error: true};
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        [process.env.VENDURE_CHANNEL_TOKEN_HEADER || 'vendure-token']:
            process.env.VENDURE_CHANNEL_TOKEN ||
            process.env.NEXT_PUBLIC_VENDURE_CHANNEL_TOKEN ||
            '__default_channel__',
        'Apollo-Require-Preflight': 'true',
    };
    const operation = {
        query: 'mutation($id:ID!,$reference:String,$file:Upload){submitTransferProof(orderId:$id,reference:$reference,file:$file)}',
        variables: {id, reference, file: null},
    };
    let body: FormData | string;
    if (hasFile) {
        const upload = new FormData();
        upload.set('operations', JSON.stringify(operation));
        upload.set('map', JSON.stringify({'0': ['variables.file']}));
        upload.set('0', file);
        body = upload;
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(operation);
    }
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body,
            cache: 'no-store',
            signal: AbortSignal.timeout(45000),
        });
        if (!response.ok) return {error: true};
        const result = await response.json();
        if (result.errors?.length) return {error: true};
        return {info: result.data.submitTransferProof};
    } catch {
        return {error: true};
    }
}
