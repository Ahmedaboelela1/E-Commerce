import {parse} from 'graphql';
import type {TadaDocumentNode} from 'gql.tada';
import {query} from '@/platform/vendure/api';
import {getAuthToken} from '@/platform/vendure/auth-token';
import {getActiveCurrencyCode} from '@/features/currency/currency-server';

export async function requestGrowth<T>(
    source: string,
    variables: Record<string, unknown> = {},
    authenticated = false,
    locale = 'en',
) {
    if (authenticated && !(await getAuthToken()))
        throw new Error('Authentication required');
    const document = parse(source) as TadaDocumentNode<
        T,
        Record<string, unknown>
    >;
    return query(document, variables, {
        useAuthToken: authenticated,
        languageCode: locale,
        currencyCode: await getActiveCurrencyCode(),
    });
}
