import { executeGraphQLQuery } from './graphql';

const testAccount = {
    apiKey: 'sk_live_7HTsxeLcNtDGH6ZArqSKDDk8',
    accountNumber: 'A-4FB4AE60',
    name: 'Test Account'
};

// Extended query to get more details about offers
const getExtendedBenefitsList = {
    operation: "getPartnerOfferGroups",
    variables: { first: 50 },
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
                            description
                        }
                    }
                }
            }
        }
    `
};

async function checkDeals() {
    try {
        console.log('Fetching available Octoplus deals (including upcoming)...\n');

        const response = await executeGraphQLQuery(
            testAccount,
            getExtendedBenefitsList
        );

        const offers = response.octoplusOfferGroups.edges
            .flatMap((edge: any) => edge.node.octoplusOffers);

        console.log(`Found ${offers.length} total offers:\n`);

        // Group offers by their status
        const claimable = offers.filter((o: any) => o.claimAbility.canClaimOffer);
        const alreadyClaimed = offers.filter((o: any) =>
            o.claimAbility.cannotClaimReason === 'MAX_CLAIMS_PER_PERIOD_REACHED'
        );
        const outOfStock = offers.filter((o: any) =>
            o.claimAbility.cannotClaimReason === 'OUT_OF_STOCK'
        );
        const notYetAvailable = offers.filter((o: any) =>
            o.claimAbility.cannotClaimReason &&
            o.claimAbility.cannotClaimReason !== 'MAX_CLAIMS_PER_PERIOD_REACHED' &&
            o.claimAbility.cannotClaimReason !== 'OUT_OF_STOCK'
        );

        // Check for unique cannotClaimReason values
        const allReasons = new Set(
            offers
                .filter((o: any) => o.claimAbility.cannotClaimReason)
                .map((o: any) => o.claimAbility.cannotClaimReason)
        );
        console.log('📊 All cannotClaimReason values found:', Array.from(allReasons), '\n');

        if (notYetAvailable.length > 0) {
            console.log(`\n🔜 === NOT YET AVAILABLE (${notYetAvailable.length}) ===`);
            notYetAvailable.forEach((offer: any) => {
                console.log(`• ${offer.name}`);
                console.log(`  Slug: ${offer.slug}`);
                console.log(`  Reason: ${offer.claimAbility.cannotClaimReason}`);
                console.log(`  Claim by: ${offer.claimBy}`);
                console.log('');
            });
        } else {
            console.log('⏰ No upcoming/not-yet-available deals found\n');
        }

        console.log(`\n✅ === CLAIMABLE NOW (${claimable.length}) ===`);
        claimable.forEach((offer: any) => {
            console.log(`• ${offer.name} (${offer.slug})`);
            console.log(`  Claim by: ${offer.claimBy}`);
        });

        console.log(`\n✓ === ALREADY CLAIMED THIS PERIOD (${alreadyClaimed.length}) ===`);
        alreadyClaimed.forEach((offer: any) => {
            console.log(`• ${offer.name} (${offer.slug})`);
        });

        console.log(`\n❌ === OUT OF STOCK (${outOfStock.length}) ===`);
        outOfStock.forEach((offer: any) => {
            console.log(`• ${offer.name} (${offer.slug})`);
        });

    } catch (error) {
        console.error('Error fetching deals:', error);
        throw error;
    }
}

checkDeals();
