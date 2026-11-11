import {UserInputError} from '@vendure/core';

export function identifier(value: string | number): number {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < 1)
        throw new UserInputError('Invalid identifier');
    return result;
}

export function text(value: unknown, max: number, required = false): string {
    if (typeof value !== 'string') {
        if (required)
            throw new UserInputError('A required text field is missing');
        return '';
    }
    const result = value.trim();
    if (result.length > max || (required && !result))
        throw new UserInputError('Text field is empty or too long');
    return result;
}

export function integer(value: unknown, min: number, max: number): number {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
    ) {
        throw new UserInputError(
            `Expected a whole number from ${min} to ${max}`,
        );
    }
    return value;
}

export function trackingUrl(carrier: string, code: string): string | null {
    if (!code) return null;
    const value = encodeURIComponent(code);
    if (carrier.toLowerCase() === 'aramex')
        return `https://www.aramex.com/track/results?ShipmentNumber=${value}`;
    if (carrier.toLowerCase() === 'dhl')
        return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${value}`;
    return null;
}

export function shipmentAllowed(
    phoneStatus: string,
    bankAwaitingReceipt: boolean,
): string | undefined {
    if (phoneStatus !== 'confirmed')
        return 'Confirm the order by phone before shipping.';
    if (bankAwaitingReceipt)
        return 'Verify the bank transfer and settle the payment before shipping.';
}
