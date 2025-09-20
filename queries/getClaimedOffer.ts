// TypeScript interfaces for the claimed offer response
export interface OctoplusVoucher {
    __typename: string;
    code: string;
    barcodeValue: string;
    barcodeFormat: string;
    expiresAt: string;
    type: string;
}

export interface OctoplusOfferImageUrls {
    __typename: string;
    banner: string;
    bannerMobile: string;
    logo: string;
}

export interface OctoplusOffer {
    __typename: string;
    availableSitesUrl: string;
    description: string;
    imageUrls: OctoplusOfferImageUrls;
    longDescription: string;
    name: string;
    partnerName: string;
    partnerSiteUrl: string | null;
    priceTag: string;
    slug: string;
    termsAndConditions: string;
    usageInstructions: string;
}

export interface OctoplusReward {
    __typename: string;
    id: number;
    accountNumber: string;
    status: string;
    vouchers: OctoplusVoucher[];
    offer: OctoplusOffer;
}

export interface ClaimedOfferResponse {
    octoplusRewards: OctoplusReward[];
}

export const getClaimedOffer = {
    operation: "getOctoplusRewardsById",
    variables: {}, // rewardId will be passed when calling the function
    query: `
        query getOctoplusRewardsById($rewardId: Int) {
            octoplusRewards(rewardId: $rewardId) {
                __typename
                id
                accountNumber
                status
                vouchers {
                    __typename
                    ... on OctoplusVoucherType {
                        code
                        barcodeValue
                        barcodeFormat
                        expiresAt
                        type
                        __typename
                    }
                }
                offer {
                    __typename
                    availableSitesUrl
                    description
                    imageUrls {
                        __typename
                        banner
                        bannerMobile
                        logo
                    }
                    longDescription
                    name
                    partnerName
                    partnerSiteUrl
                    priceTag
                    slug
                    termsAndConditions
                    usageInstructions
                }
            }
        }
    `
};

// Alternative query that might work with accountNumber only (to get all claimed rewards)
export const getAllClaimedOffers = {
    operation: "getOctoplusRewards",
    variables: {}, // accountNumber will be automatically added by graphql.ts
    query: `
        query getOctoplusRewards($accountNumber: String!) {
            octoplusRewards(accountNumber: $accountNumber) {
                __typename
                id
                accountNumber
                status
                vouchers {
                    __typename
                    ... on OctoplusVoucherType {
                        code
                        barcodeValue
                        barcodeFormat
                        expiresAt
                        type
                        __typename
                    }
                }
                offer {
                    __typename
                    availableSitesUrl
                    description
                    imageUrls {
                        __typename
                        banner
                        bannerMobile
                        logo
                    }
                    longDescription
                    name
                    partnerName
                    partnerSiteUrl
                    priceTag
                    slug
                    termsAndConditions
                    usageInstructions
                }
            }
        }
    `
};