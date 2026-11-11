import {parse} from 'graphql';
import type {TadaDocumentNode} from 'gql.tada';

// The operations plugin extends this shop's schema beyond the upstream starter.
const document = <T, V extends Record<string, unknown>>(source: string) =>
    parse(source) as TadaDocumentNode<T, V>;

export interface OrderOperationsInfo {
    orderId: string;
    phoneStatus: string;
    receiptStatus: string;
    transferReference: string;
    receiptUploaded: boolean;
    receiptReviewNote?: string;
    invoiceAvailable: boolean;
    transferPending: boolean;
    shipments: Array<{
        id: string;
        state: string;
        carrier: string;
        trackingCode: string;
        trackingUrl: string | null;
    }>;
}
export interface FileDownload {
    filename: string;
    mimeType: string;
    dataBase64: string;
}
export interface ReviewPage {
    items: Array<{
        id: string;
        rating: number;
        text: string;
        author: string;
        createdAt: string;
        verifiedPurchase: boolean;
    }>;
    total: number;
    average: number;
}
export interface MyReview {
    review: {id: string; rating: number; text: string; status: string} | null;
    eligible: boolean;
}
export interface WishlistProduct {
    id: string;
    name: string;
    slug: string;
    featuredAsset: {preview: string} | null;
    variants: Array<{priceWithTax: number; currencyCode: string}>;
}

export const WishlistIds = document<
    {myWishlistIds: string[]},
    Record<string, never>
>('query{myWishlistIds}');
export const WishlistProducts = document<
    {myWishlistProducts: WishlistProduct[]},
    Record<string, never>
>(
    `query{myWishlistProducts{id name slug featuredAsset{preview} variants{priceWithTax currencyCode}}}`,
);
export const ToggleWishlist = document<
    {toggleWishlist: string[]},
    {id: string}
>('mutation($id:ID!){toggleWishlist(productId:$id)}');
export const OrderInfo = document<
    {myOrderOperations: OrderOperationsInfo},
    {id: string}
>('query($id:ID!){myOrderOperations(orderId:$id)}');
export const OrderInvoice = document<
    {myOrderInvoice: FileDownload},
    {id: string}
>('query($id:ID!){myOrderInvoice(orderId:$id)}');
export const PublicReviews = document<
    {productReviews: ReviewPage},
    {id: string; skip: number}
>('query($id:ID!,$skip:Int){productReviews(productId:$id,skip:$skip)}');
export const OwnReview = document<{myProductReview: MyReview}, {id: string}>(
    'query($id:ID!){myProductReview(productId:$id)}',
);
export const SubmitReview = document<
    {submitProductReview: MyReview},
    {id: string; rating: number; text: string}
>(
    'mutation($id:ID!,$rating:Int!,$text:String!){submitProductReview(productId:$id,rating:$rating,text:$text)}',
);
