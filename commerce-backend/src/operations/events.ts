import {RequestContext, VendureEvent} from '@vendure/core';

export class LowStockAlertEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public recipient: string,
        public sku: string,
        public available: number,
        public threshold: number,
    ) {
        super();
    }
}
