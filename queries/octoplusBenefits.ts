// TypeScript interfaces for the benefits response
export interface ClaimAbility {
    canClaimOffer: boolean;
    cannotClaimReason: string | null;
}

export interface OctoplusOffer {
    slug: string;
    name: string;
    claimAbility: ClaimAbility;
    claimBy: string;
}

export interface OfferGroupNode {
    octoplusOffers: OctoplusOffer[];
}

export interface OfferGroupEdge {
    node: OfferGroupNode;
}

export interface OctoplusOfferGroups {
    edges: OfferGroupEdge[];
}

export interface BenefitsResponse {
    octoplusOfferGroups: OctoplusOfferGroups;
}

export const getBenefitsList = {
    operation: "getPartnerOfferGroups",
    variables: { first: 12 },
    query: `
        query getPartnerOfferGroups($accountNumber: String!, $first: Int!) {
            octoplusOfferGroups(accountNumber: $accountNumber, first: $first) {
                edges {
                    node {
                        octoplusOffers {
                            slug
                            name
                            claimAbility {
                                canClaimOffer
                                cannotClaimReason
                            }
                            claimBy
                        }
                    }
                }
            }
        }
    `
};