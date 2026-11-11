import gql from 'graphql-tag';
import type {GraphQLSchema} from 'graphql';

export const shopSchema = (schema?: GraphQLSchema) => gql`
    ${schema?.getType('Upload') ? '' : 'scalar Upload'}
    extend type Query {
        myOrderOperations(orderId: ID!): JSON!
        myOrderInvoice(orderId: ID!): JSON!
        myWishlistIds: [ID!]!
        myWishlistProducts: [Product!]!
        productReviews(productId: ID!, skip: Int): JSON!
        myProductReview(productId: ID!): JSON!
    }
    extend type Mutation {
        submitTransferProof(
            orderId: ID!
            reference: String
            file: Upload
        ): JSON!
        toggleWishlist(productId: ID!): JSON!
        submitProductReview(productId: ID!, rating: Int!, text: String!): JSON!
    }
`;

export const adminSchema = gql`
    extend type Query {
        shopOperationsSettings: JSON!
        shopOperationsOrders(search: String, skip: Int): JSON!
        shopOperationsOrder(orderId: ID!): JSON!
        shopTransferReceipt(orderId: ID!): JSON
        shopOrderInvoice(orderId: ID!): JSON!
        shopSalesReport(from: String!, to: String!): JSON!
        shopOperationsInventory(skip: Int): JSON!
        shopProductReviews(status: String, skip: Int): JSON!
    }
    extend type Mutation {
        saveShopOperationsSettings(input: JSON!): JSON!
        updateOrderCallback(
            orderId: ID!
            status: String!
            notes: String!
            version: Int!
        ): JSON!
        verifyShopTransfer(
            orderId: ID!
            reference: String!
            confirmFundsReceived: Boolean!
        ): JSON!
        rejectShopTransferProof(orderId: ID!, note: String!): JSON!
        dispatchShopOrder(
            orderId: ID!
            carrier: String!
            trackingCode: String!
        ): JSON!
        createShopCoupon(input: JSON!): JSON!
        checkShopLowStock: JSON!
        moderateShopReview(reviewId: ID!, status: String!, version: Int!): JSON!
    }
`;
