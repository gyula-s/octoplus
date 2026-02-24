import { executeGraphQLQuery } from './graphql';
import { getBenefitsList, BenefitsResponse } from './queries/octoplusBenefits';
import { claimBenefit, ClaimRewardResponse } from './queries/claimBenefit';
import { getAllClaimedOffers, ClaimedOfferResponse } from './queries/getClaimedOffer';
import { loadOctopusAccounts, validateAccounts, OctopusAccount } from './accounts';
import { VoucherInfo } from './src/types';

// ============================================================================
// Result types returned by the API functions
// ============================================================================

export interface OfferStatus {
    found: boolean;
    canClaim: boolean;
    cannotClaimReason?: string | null;
}

export interface ClaimSuccess {
    voucher: VoucherInfo;
}

export interface FetchedVoucher {
    voucher: VoucherInfo | null;
}

// ============================================================================
// API functions - pure Octopus API interactions, no state/email logic
// ============================================================================

/**
 * Check if the Caffe Nero offer exists and whether it can be claimed.
 */
export async function checkCaffeNeroOffer(account: OctopusAccount): Promise<OfferStatus> {
    const benefitsData: BenefitsResponse = await executeGraphQLQuery(account, getBenefitsList);

    for (const edge of benefitsData.octoplusOfferGroups.edges) {
        const offer = edge.node.octoplusOffers.find(o => o.slug === 'caffe-nero');
        if (offer) {
            return {
                found: true,
                canClaim: offer.claimAbility.canClaimOffer,
                cannotClaimReason: offer.claimAbility.cannotClaimReason,
            };
        }
    }

    return { found: false, canClaim: false };
}

/**
 * Claim the Caffe Nero offer and return the voucher details.
 * Only call this when checkCaffeNeroOffer reports canClaim === true.
 */
export async function claimCaffeNero(account: OctopusAccount): Promise<ClaimSuccess> {
    const claimResponse: ClaimRewardResponse = await executeGraphQLQuery(
        account,
        claimBenefit,
        { offerSlug: 'caffe-nero' }
    );
    console.log(`[API] Claimed reward ID: ${claimResponse.claimOctoplusReward.rewardId}`);

    const allClaimed: ClaimedOfferResponse = await executeGraphQLQuery(account, getAllClaimedOffers);
    const reward = allClaimed.octoplusRewards.find(r => r.offer.slug === 'caffe-nero');

    if (!reward || reward.vouchers.length === 0) {
        throw new Error('Claimed successfully but could not retrieve voucher details');
    }

    const voucher = reward.vouchers[0];
    return {
        voucher: {
            code: voucher.code,
            barcode: voucher.barcodeValue,
            expiresAt: voucher.expiresAt,
            accountNumber: account.accountNumber,
        },
    };
}

/**
 * Fetch the latest Caffe Nero voucher from already-claimed rewards.
 * Returns null if no voucher is found.
 */
export async function fetchLatestCaffeNeroVoucher(account: OctopusAccount): Promise<FetchedVoucher> {
    const allClaimed: ClaimedOfferResponse = await executeGraphQLQuery(account, getAllClaimedOffers);
    const reward = allClaimed.octoplusRewards.find(r => r.offer.slug === 'caffe-nero');

    if (!reward || reward.vouchers.length === 0) {
        return { voucher: null };
    }

    const voucher = reward.vouchers[0];
    return {
        voucher: {
            code: voucher.code,
            barcode: voucher.barcodeValue,
            expiresAt: voucher.expiresAt,
            accountNumber: account.accountNumber,
        },
    };
}

// ============================================================================
// Legacy standalone entry point (for local testing only)
// ============================================================================

export async function manageCaffeNeroBenefit() {
    try {
        const accounts = loadOctopusAccounts();
        validateAccounts(accounts);

        console.log(`Starting Caffe Nero benefit processing for ${accounts.length} account(s)...\n`);

        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            console.log(`Processing ${account.name} (${i + 1}/${accounts.length})`);

            const status = await checkCaffeNeroOffer(account);
            if (!status.found) {
                console.log('Caffe Nero offer not found');
                continue;
            }
            if (status.canClaim) {
                const result = await claimCaffeNero(account);
                console.log(`Claimed: ${result.voucher.code}`);
            } else {
                console.log(`Cannot claim: ${status.cannotClaimReason}`);
                const fetched = await fetchLatestCaffeNeroVoucher(account);
                if (fetched.voucher) {
                    console.log(`Existing voucher: ${fetched.voucher.code} (expires ${fetched.voucher.expiresAt})`);
                }
            }

            if (i < accounts.length - 1) {
                console.log('\n' + '='.repeat(60) + '\n');
            }
        }

        console.log(`\nCompleted processing all ${accounts.length} account(s)!`);
    } catch (error) {
        console.error('Error in multi-account processing:', error);
        throw error;
    }
}

// Run the main logic when this file is executed directly
if (require.main === module) {
    manageCaffeNeroBenefit();
}
