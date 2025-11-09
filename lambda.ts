/**
 * AWS Lambda handler for Octoplus Caffe Nero voucher claiming
 *
 * This handler processes a single account per invocation.
 * Multiple EventBridge schedules trigger this function in parallel for different accounts.
 */

import { ScheduledEvent, ClaimResult } from './src/types';
import { getAccountCredentials } from './src/services/parameters';
import { shouldSkipAccount, shouldSendEmail, saveClaimState } from './src/services/state';
import { sendVoucherEmail } from './src/services/email';
import { manageCaffeNeroBenefitForAccount } from './index';

interface LambdaContext {
  functionName: string;
  functionVersion: string;
  requestId: string;
  logGroupName: string;
  logStreamName: string;
  remainingTimeInMillis: number;
}

interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * Lambda handler entry point
 *
 * Processes a single Octopus Energy account:
 * 1. Fetch credentials from SSM Parameter Store
 * 2. Check DynamoDB state (skip if already processed this week)
 * 3. Call Octopus API to claim voucher
 * 4. Send email with QR code (if configured)
 * 5. Save state to DynamoDB
 */
export const handler = async (
  event: ScheduledEvent,
  context: LambdaContext
): Promise<LambdaResponse> => {
  const startTime = new Date();
  const requestId = context.requestId;

  console.log('='.repeat(80));
  console.log('🚀 LAMBDA START | Octoplus Caffe Nero Auto-Claimer');
  console.log('='.repeat(80));
  console.log(`📋 Request ID:     ${requestId}`);
  console.log(`🕐 Start Time:     ${startTime.toISOString()}`);
  console.log(`⚙️  Function:       ${context.functionName} (v${context.functionVersion})`);
  console.log(`⏱️  Timeout:        ${Math.floor(context.remainingTimeInMillis / 1000)}s remaining`);
  console.log(`📦 Account Number: ${event.accountNumber}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Validate event input
    if (!event.accountNumber) {
      throw new Error('Missing accountNumber in event payload');
    }

    console.log(`[Account ${event.accountNumber}] Starting processing...`);

    // Step 1: Fetch credentials from SSM Parameter Store
    console.log('');
    console.log('-'.repeat(80));
    console.log('STEP 1: Fetch Credentials from SSM Parameter Store');
    console.log('-'.repeat(80));

    const credentials = await getAccountCredentials(event.accountNumber);

    console.log(`✓ Credentials loaded for account: ${credentials.accountNumber}`);
    console.log(`✓ API Key: ${credentials.apiKey.substring(0, 12)}...`);
    if (credentials.nickname) {
      console.log(`✓ Nickname: ${credentials.nickname}`);
    }
    if (credentials.emails.length > 0) {
      console.log(`✓ Email(s) configured: ${credentials.emails.join(', ')}`);
      console.log(`✓ Total recipients: ${credentials.emails.length}`);
    } else {
      console.log(`⚠ No email configured for account ${event.accountNumber}`);
    }

    // Step 2: Check DynamoDB state (for info only, not blocking)
    console.log('');
    console.log('-'.repeat(80));
    console.log('STEP 2: Check DynamoDB State');
    console.log('-'.repeat(80));

    const skip = await shouldSkipAccount(credentials.accountNumber);

    if (skip) {
      console.log('');
      console.log('ℹ️  NOTE: Account already processed this week');
      console.log('📅 State is fresh (after most recent Saturday 9 AM UTC)');
      console.log('📧 Will still attempt to send email if voucher exists');
      console.log('');
    } else {
      console.log('✓ State is stale or missing - proceeding with claim attempt');
    }

    // Step 3: Claim voucher from Octopus API (or fetch existing)
    console.log('');
    console.log('-'.repeat(80));
    console.log('STEP 3: Fetch Caffe Nero Voucher from Octopus API');
    console.log('-'.repeat(80));

    const claimResult: ClaimResult = await manageCaffeNeroBenefitForAccount(
      credentials.apiKey,
      credentials.accountNumber
    );

    // Check if we got voucher details (either newly claimed or already claimed)
    if (!claimResult.voucher) {
      console.log('');
      console.log(`❌ No voucher available: ${claimResult.error || 'Unknown error'}`);

      const endTime = new Date();
      const executionTime = endTime.getTime() - startTime.getTime();

      return {
        statusCode: 200, // Still return 200 (not Lambda failure, just no voucher)
        body: JSON.stringify({
          success: false,
          error: claimResult.error,
          alreadyClaimed: claimResult.alreadyClaimed,
          accountNumber: credentials.accountNumber,
          executionTime: `${executionTime}ms`,
          timestamp: endTime.toISOString(),
        }, null, 2),
      };
    }

    // We have voucher details - either newly claimed or already claimed
    if (claimResult.success) {
      console.log('✓ Voucher claimed successfully!');
    } else if (claimResult.alreadyClaimed) {
      console.log('✓ Voucher already claimed (sending email with existing voucher)');
    }

    console.log(`  Code: ${claimResult.voucher.code}`);
    console.log(`  Barcode: ${claimResult.voucher.barcode}`);
    if (claimResult.voucher.expiresAt) {
      console.log(`  Expires: ${new Date(claimResult.voucher.expiresAt).toLocaleDateString()}`);
    }

    // Step 4: Send email with QR code (if configured and needed)
    let emailSent = false;

    console.log('');
    console.log('-'.repeat(80));
    console.log('STEP 4: Check Email Sending');
    console.log('-'.repeat(80));

    if (credentials.emails.length === 0) {
      console.log('⏭️  Skipping email (no email address configured)');
    } else if (!claimResult.voucher) {
      console.log('⏭️  Skipping email (no voucher available)');
    } else {
      // Check if we should send email based on FORCE_EMAIL_SEND setting
      const shouldSend = await shouldSendEmail(
        credentials.accountNumber,
        claimResult.voucher.code
      );

      if (shouldSend) {
        console.log(`📧 Sending email with QR code to ${credentials.emails.length} recipient(s)...`);
        try {
          // Add nickname to voucher info for email personalization
          const voucherWithNickname = {
            ...claimResult.voucher,
            nickname: credentials.nickname,
          };
          await sendVoucherEmail(credentials.emails, voucherWithNickname);
          emailSent = true;
          console.log(`✓ Email sent successfully to: ${credentials.emails.join(', ')}`);
        } catch (emailError) {
          console.error('❌ Failed to send email (continuing anyway):', emailError);
          emailSent = false;
        }
      } else {
        console.log('⏭️  Skipping email (already sent for this voucher code)');
      }
    }

    // Step 5: Save state to DynamoDB
    console.log('');
    console.log('-'.repeat(80));
    console.log('STEP 5: Save State to DynamoDB');
    console.log('-'.repeat(80));

    await saveClaimState(
      credentials.accountNumber,
      claimResult.voucher?.code || 'UNKNOWN',
      emailSent
    );

    console.log('✓ State saved successfully');

    // Success summary
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ SUCCESS | Lambda execution completed');
    console.log('='.repeat(80));
    console.log(`⏱️  Execution Time: ${executionTime}ms`);
    console.log(`🕐 End Time:       ${endTime.toISOString()}`);
    console.log(`📋 Request ID:     ${requestId}`);
    console.log(`📧 Email Sent:     ${emailSent ? 'Yes' : 'No'}`);
    console.log('='.repeat(80));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        accountNumber: credentials.accountNumber,
        voucherCode: claimResult.voucher?.code,
        emailSent,
        executionTime: `${executionTime}ms`,
        timestamp: endTime.toISOString(),
        requestId,
      }, null, 2),
    };

  } catch (error) {
    const errorTime = new Date();
    const executionTime = errorTime.getTime() - startTime.getTime();

    console.error('');
    console.error('='.repeat(80));
    console.error('❌ FAILURE | Lambda execution failed');
    console.error('='.repeat(80));
    console.error(`🕐 Error Time:     ${errorTime.toISOString()}`);
    console.error(`⏱️  Execution Time: ${executionTime}ms`);
    console.error(`📋 Request ID:     ${requestId}`);
    console.error('='.repeat(80));

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`📝 Error Message:`, errorMessage);
    if (errorStack) {
      console.error('📋 Stack Trace:');
      console.error(errorStack);
    }

    console.error('='.repeat(80));

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        stack: errorStack,
        accountNumber: event.accountNumber,
        executionTime: `${executionTime}ms`,
        timestamp: errorTime.toISOString(),
        requestId,
      }, null, 2),
    };
  }
};
