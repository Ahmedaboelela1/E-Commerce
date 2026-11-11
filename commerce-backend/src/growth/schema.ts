import gql from 'graphql-tag';
export const growthShopSchema = gql`
    extend type Query {
        shopVariantAvailability(variantId: ID!): JSON!
        shopProductContent(productId: ID!): JSON!
        compareShopProducts(productIds: [ID!]!): JSON!
        shopBundles(skip: Int): JSON!
        myStockWatches: JSON!
        myShopMailPreference: JSON!
        mySchoolQuotes(skip: Int): JSON!
        myReturnRequests(skip: Int): JSON!
        myReturnEligibility(orderId: ID!): JSON!
        myReturnPhoto(returnId: ID!, index: Int!): JSON!
        myRecoveryCart(token: String!): JSON!
        shopGrowthFeatures: JSON!
    }
    extend type Mutation {
        addShopBundle(bundleId: ID!, quantity: Int!): JSON!
        setShopStockWatch(variantId: ID!, active: Boolean!): JSON!
        setShopCartReminderConsent(consent: Boolean!): JSON!
        unsubscribeShopMail(kind: String!, id: ID!, token: String!): JSON!
        requestSchoolQuote(input: JSON!): JSON!
        respondToSchoolQuote(
            quoteId: ID!
            accept: Boolean!
            version: Int!
        ): JSON!
        requestShopReturn(orderId: ID!, input: JSON!): JSON!
        uploadShopReturnPhoto(returnId: ID!, file: Upload!): JSON!
    }
`;
export const growthAdminSchema = gql`
    extend type Query {
        shopGrowthSettings: JSON!
        shopCatalogContent(productId: ID!, languageCode: String): JSON!
        shopAdminBundles(skip: Int): JSON!
        shopSchoolQuotes(skip: Int): JSON!
        shopReturnRequests(skip: Int): JSON!
        shopReturnPhoto(returnId: ID!, index: Int!): JSON!
    }
    extend type Mutation {
        saveShopGrowthSettings(input: JSON!): JSON!
        saveShopProductContent(
            productId: ID!
            languageCode: String!
            input: JSON!
            version: Int!
        ): JSON!
        saveShopBundle(input: JSON!): JSON!
        publishSchoolQuote(
            quoteId: ID!
            input: JSON!
            version: Int!
            publish: Boolean!
        ): JSON!
        linkSchoolQuoteOrder(quoteId: ID!, orderId: ID!, version: Int!): JSON!
        updateShopReturn(returnId: ID!, input: JSON!, version: Int!): JSON!
        runShopCustomerNotifications: JSON!
    }
`;
