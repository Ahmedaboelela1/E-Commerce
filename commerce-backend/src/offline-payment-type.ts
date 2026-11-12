export type OfflinePaymentType = 'cash-on-delivery' | 'bank-transfer';
/** Payment handlers write paymentType themselves; configured method codes may be arbitrary. */
export function offlinePaymentType(payment: {method: string; metadata?: unknown}): OfflinePaymentType | null {
    const metadata = payment.metadata;
    const type = metadata && typeof metadata === 'object' && 'paymentType' in metadata
        ? metadata.paymentType : undefined;
    if (type !== undefined) {
        return type === 'cash-on-delivery' || type === 'bank-transfer' ? type : null;
    }
    // Older stored payments used canonical codes before handler metadata existed.
    return payment.method === 'cash-on-delivery' || payment.method === 'bank-transfer'
        ? payment.method : null;
}
