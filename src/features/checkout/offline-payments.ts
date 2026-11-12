export type OfflinePaymentType = 'cash-on-delivery' | 'bank-transfer';
type PaymentMethod = {code: string; offlineType?: string | null};

export function getOfflinePaymentType(method: PaymentMethod | string): OfflinePaymentType | null {
    // An explicit null from the API must not fall back to a misleading method code.
    const type = typeof method === 'string' ? method
        : ('offlineType' in method ? method.offlineType : method.code);
    return type === 'cash-on-delivery' || type === 'bank-transfer' ? type : null;
}

export function isOfflinePaymentMethod(method: PaymentMethod | string): boolean {
    return getOfflinePaymentType(method) !== null;
}

export function getTransferInstructions(payments: ReadonlyArray<{method: string; state: string; metadata?: unknown}> | null | undefined): string | undefined {
    for (const payment of payments || []) {
        if (payment.state !== 'Authorized') continue;
        const metadata = payment.metadata;
        if (!metadata || typeof metadata !== 'object' || !('public' in metadata)) continue;
        const data = metadata.public;
        if (!data || typeof data !== 'object') continue;
        const type = 'paymentType' in data ? data.paymentType : payment.method;
        if (type === 'bank-transfer' && 'paymentInstructions' in data && typeof data.paymentInstructions === 'string') {
            return data.paymentInstructions;
        }
    }
}
