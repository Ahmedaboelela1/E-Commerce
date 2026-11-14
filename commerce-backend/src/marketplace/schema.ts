import gql from 'graphql-tag';
export const marketplaceAdminSchema = gql`
    extend type Query {
        marketplaceAccess: JSON!
        marketplaceVendors: JSON!
        marketplaceProducts(search: String, skip: Int): JSON!
        marketplaceProduct(id: ID!): JSON!
        marketplaceOrders(skip: Int): JSON!
        marketplaceOrder(id: ID!): JSON!
        marketplaceDeliveryRates: JSON!
        marketplacePaymentMethods: JSON!
    }
    extend type Mutation {
        createStoreAdmin(input: JSON!): JSON!
        createStoreSeller(input: JSON!): JSON!
        setStoreSellerActive(input: JSON!): JSON!
        saveMarketplaceProduct(input: JSON!): JSON!
        uploadMarketplaceImage(file: Upload!, vendorId: ID): JSON!
        saveMarketplaceDeliveryRate(input: JSON!): JSON!
        saveMarketplacePaymentMethod(input: JSON!): JSON!
        dispatchMarketplaceItems(input: JSON!): JSON!
        transitionMarketplaceShipment(id: ID!, state: String!): JSON!
        cancelStoreOrder(input: JSON!): JSON!
        refundStoreOrder(input: JSON!): JSON!
        settleStoreRefund(input: JSON!): JSON!
        confirmStoreCashReceipt(
            orderId: ID!
            confirmed: Boolean!
            reference: String!
        ): JSON!
    }
`;
export const marketplaceShopSchema = gql`
    extend type Query {
        marketplaceDeliveryGroups: JSON!
    }
    extend type ShippingMethodQuote {
        deliveryGroup: String!
        sellerName: String!
    }
    extend type Mutation {
        setMarketplaceDelivery(shippingMethodIds: [ID!]!): JSON!
    }
`;
