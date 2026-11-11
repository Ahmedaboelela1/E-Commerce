export type EntityId = string | number;
export interface ProductHelp {
    specs: {
        ageRange: string;
        programming: string;
        boxContents: string;
        competitions: string;
    };
    resources: Array<{kind: string; title: string; url: string}>;
    faqs: Array<{question: string; answer: string}>;
}
export interface ComparedProduct {
    id: EntityId;
    name: string;
    slug: string;
    preview: string | null;
    minimum: number | null;
    maximum: number | null;
    currencyCode: string;
    content: ProductHelp;
    variants: Array<{
        id: EntityId;
        name: string;
        sku: string;
        price: number;
        available: boolean;
    }>;
}
export interface ShopBundle {
    id: EntityId;
    name: string;
    description: string;
    price: number;
    normalPrice: number;
    saving: number;
    currencyCode: string;
    pricesIncludeTax: boolean;
    available: boolean;
    components: Array<{
        variantId: EntityId;
        productId: EntityId;
        name: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        preview: string | null;
    }>;
}
export interface StockWatchInfo {
    id: EntityId;
    variantId: EntityId;
    productId: EntityId;
    name: string;
    slug: string;
    createdAt: string;
}
export interface GrowthFeatures {
    returnsEnabled: boolean;
    returnWindowDays: number;
    restockEnabled: boolean;
    cartReminderOptInAvailable: boolean;
}
export interface QuoteItem {
    variantId: EntityId;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
}
export interface SchoolQuoteInfo {
    id: EntityId;
    organization: string;
    phone: string;
    notes: string;
    status: string;
    createdAt: string;
    version: number;
    orderId: EntityId | null;
    items: QuoteItem[];
    offer: {
        items: QuoteItem[];
        shipping: number;
        currencyCode: string;
        message: string;
        expiresAt: string;
        sellerName: string;
        sellerAddress: string;
    } | null;
}
export interface ReturnInfo {
    id: EntityId;
    orderId: EntityId;
    kind: string;
    status: string;
    reason: string;
    photoCount: number;
    version: number;
    publicMessage: string;
    resolution: string | null;
    refundId: EntityId | null;
    exchangeOrderId: EntityId | null;
    items: Array<{
        orderLineId: EntityId;
        name: string;
        sku: string;
        quantity: number;
        amount: number;
    }>;
    createdAt: string;
}
export interface ReturnEligibility {
    enabled: boolean;
    windowDays: number;
    eligible: boolean;
    deliveredAt: string | null;
    lines: Array<{id: EntityId; name: string; quantity: number}>;
}
