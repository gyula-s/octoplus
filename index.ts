import { executeGraphQLQuery } from './graphql';
import { getBenefitsList, BenefitsResponse } from './queries/octoplusBenefits';
import { claimBenefit, ClaimRewardResponse } from './queries/claimBenefit';
import { getAllClaimedOffers, ClaimedOfferResponse } from './queries/getClaimedOffer';
import { loadOctopusAccounts, validateAccounts, OctopusAccount } from './accounts';

async function getClaimedOfferBySlug(account: OctopusAccount, offerSlug: string) {
    try {
        // Get all claimed offers and filter by slug
        const allClaimedOffers: ClaimedOfferResponse = await executeGraphQLQuery(account, getAllClaimedOffers);

        console.log('Successfully fetched all claimed offers, searching for:', offerSlug);
        
        // Find the specific offer by slug
        const matchingReward = allClaimedOffers.octoplusRewards.find(
            reward => reward.offer.slug === offerSlug
        );

        if (matchingReward) {
            console.log(`Found offer: ${matchingReward.offer.name}`);
            console.log(`Status: ${matchingReward.status}`);
            
            if (matchingReward.vouchers.length > 0) {
                const voucher = matchingReward.vouchers[0];
                console.log(`Voucher Code: ${voucher.code}`);
                console.log(`Barcode Value: ${voucher.barcodeValue}`);
                console.log(`Barcode Format: ${voucher.barcodeFormat}`);
                console.log(`Expires At: ${voucher.expiresAt}`);
                console.log('Usage Instructions:', matchingReward.offer.usageInstructions);
            }
        } else {
            console.log(`No claimed offer found with slug: ${offerSlug}`);
            console.log('Available claimed offers:');
            allClaimedOffers.octoplusRewards.forEach(reward => {
                console.log(`- ${reward.offer.slug}: ${reward.offer.name}`);
            });
        }

    } catch (error) {
        console.error('Failed to get claimed offer by slug:', error);
    }
}

export async function manageCaffeNeroBenefitForAccount(account: OctopusAccount) {
    const targetSlug = 'caffe-nero';
    
    try {
        console.log(`🔍 Checking Caffe Nero benefit status for ${account.name}...\n`);
        
        // Step 1: Get available benefits
        console.log('1️⃣ Fetching available benefits...');
        const benefitsData: BenefitsResponse = await executeGraphQLQuery(account, getBenefitsList);
        
        // Find Caffe Nero in the benefits list
        let caffeNeroOffer = null;
        for (const edge of benefitsData.octoplusOfferGroups.edges) {
            caffeNeroOffer = edge.node.octoplusOffers.find(offer => offer.slug === targetSlug);
            if (caffeNeroOffer) break;
        }
        
        if (!caffeNeroOffer) {
            console.log('❌ Caffe Nero offer not found in available benefits');
            return;
        }
        
        console.log(`📋 Found: ${caffeNeroOffer.name}`);
        console.log(`🎯 Can claim: ${caffeNeroOffer.claimAbility.canClaimOffer}`);
        if (!caffeNeroOffer.claimAbility.canClaimOffer) {
            console.log(`🚫 Reason: ${caffeNeroOffer.claimAbility.cannotClaimReason}`);
        }
        console.log('');
        
        // Step 2: Check if claimable and claim it
        if (caffeNeroOffer.claimAbility.canClaimOffer) {
            console.log('2️⃣ Benefit is claimable! Attempting to claim...');
            
            const claimResponse: ClaimRewardResponse = await executeGraphQLQuery(
                account,
                claimBenefit,
                { offerSlug: targetSlug }
            );
            
            console.log(`✅ Successfully claimed! Reward ID: ${claimResponse.claimOctoplusReward.rewardId}`);
            console.log('');
            
            // Get the voucher details for the newly claimed benefit
            console.log('3️⃣ Fetching voucher details...');
            await getClaimedOfferBySlug(account, targetSlug);
            
        } else {
            // Step 3: Check if already claimed
            console.log('2️⃣ Benefit not claimable. Checking if already claimed...');
            
            const allClaimedOffers: ClaimedOfferResponse = await executeGraphQLQuery(account, getAllClaimedOffers);
            
            const existingClaim = allClaimedOffers.octoplusRewards.find(
                reward => reward.offer.slug === targetSlug
            );
            
            if (existingClaim) {
                console.log('✅ Found existing claim! Here are your voucher details:');
                console.log('');
                console.log(`🏪 Offer: ${existingClaim.offer.name}`);
                console.log(`📊 Status: ${existingClaim.status}`);
                
                if (existingClaim.vouchers.length > 0) {
                    const voucher = existingClaim.vouchers[0];
                    console.log(`🎫 Voucher Code: ${voucher.code}`);
                    console.log(`📱 Barcode Value: ${voucher.barcodeValue}`);
                    console.log(`🔢 Barcode Format: ${voucher.barcodeFormat}`);
                    console.log(`⏰ Expires At: ${voucher.expiresAt}`);
                    console.log('');
                    
                    console.log('📝 Usage Instructions:');
                    console.log(existingClaim.offer.usageInstructions);
                } else {
                    console.log('⚠️ No vouchers found for this claim');
                }
            } else {
                console.log('❌ Caffe Nero benefit is not claimable and you haven\'t claimed it yet.');
                console.log('💡 Nothing was done. You may need to wait or check eligibility requirements.');
            }
        }
        
    } catch (error) {
        console.error(`❌ Error managing Caffe Nero benefit for ${account.name}:`, error);
    }
}

/**
 * Main function that processes Caffe Nero benefits for all configured accounts
 */
export async function manageCaffeNeroBenefit() {
    try {
        // Load and validate all configured accounts
        const accounts = loadOctopusAccounts();
        validateAccounts(accounts);
        
        console.log(`🚀 Starting Caffe Nero benefit processing for ${accounts.length} account(s)...\n`);
        
        // Process each account sequentially
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            
            console.log(`📋 Processing ${account.name} (${i + 1}/${accounts.length})`);
            console.log(`🔑 Account: ${account.accountNumber}`);
            console.log('─'.repeat(50));
            
            await manageCaffeNeroBenefitForAccount(account);
            
            // Add separator between accounts (except for the last one)
            if (i < accounts.length - 1) {
                console.log('\n' + '═'.repeat(60) + '\n');
            }
        }
        
        console.log(`\n🎉 Completed processing all ${accounts.length} account(s)!`);
        
    } catch (error) {
        console.error('❌ Error in multi-account processing:', error);
        throw error;
    }
}

// Run the main logic when this file is executed directly
if (require.main === module) {
    manageCaffeNeroBenefit();
}