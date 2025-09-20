import { executeGraphQLQuery } from './graphql';
import { getBenefitsList, BenefitsResponse } from './queries/octoplusBenefits';
import { claimBenefit, ClaimRewardResponse } from './queries/claimBenefit';
import { getAllClaimedOffers, ClaimedOfferResponse } from './queries/getClaimedOffer';

async function getClaimedOfferBySlug(offerSlug: string) {
    try {
        // Get all claimed offers and filter by slug
        const allClaimedOffers: ClaimedOfferResponse = await executeGraphQLQuery(getAllClaimedOffers);

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

export async function manageCaffeNeroBenefit() {
    const targetSlug = 'caffe-nero';
    
    try {
        console.log('🔍 Checking Caffe Nero benefit status...\n');
        
        // Step 1: Get available benefits
        console.log('1️⃣ Fetching available benefits...');
        const benefitsData: BenefitsResponse = await executeGraphQLQuery(getBenefitsList);
        
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
                claimBenefit,
                { offerSlug: targetSlug }
            );
            
            console.log(`✅ Successfully claimed! Reward ID: ${claimResponse.claimOctoplusReward.rewardId}`);
            console.log('');
            
            // Get the voucher details for the newly claimed benefit
            console.log('3️⃣ Fetching voucher details...');
            await getClaimedOfferBySlug(targetSlug);
            
        } else {
            // Step 3: Check if already claimed
            console.log('2️⃣ Benefit not claimable. Checking if already claimed...');
            
            const allClaimedOffers: ClaimedOfferResponse = await executeGraphQLQuery(getAllClaimedOffers);
            
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
        console.error('❌ Error managing Caffe Nero benefit:', error);
    }
}

// Run the main logic
manageCaffeNeroBenefit();