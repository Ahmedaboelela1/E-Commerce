export function isOfflinePaymentMethod(code: string): boolean {
    return code === 'cash-on-delivery' || code === 'bank-transfer';
}

export function getTransferInstructions(payments: ReadonlyArray<{method: string; state: string; metadata?: unknown}> | null | undefined): string | undefined {
    const payment = payments?.find(p => p.method === 'bank-transfer' && p.state === 'Authorized');
    const metadata = payment?.metadata;
    if (!metadata || typeof metadata !== 'object' || !('public' in metadata)) return;
    const publicData = metadata.public;
    if (!publicData || typeof publicData !== 'object' || !('paymentInstructions' in publicData)) return;
    return typeof publicData.paymentInstructions === 'string' ? publicData.paymentInstructions : undefined;
}
