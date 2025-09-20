// TypeScript interfaces for the claim reward response
export interface ClaimRewardResponse {
    claimOctoplusReward: {
        rewardId: string;
        __typename: string;
    };
}

export const claimBenefit = {
    operation: "claimOctoplusReward",
    variables: {}, // offerSlug will be passed when calling the function
    query: `
        mutation claimOctoplusReward($accountNumber: String!, $offerSlug: String!) {
            claimOctoplusReward(accountNumber: $accountNumber, offerSlug: $offerSlug) {
                rewardId
                __typename
            }
        }
    `
};