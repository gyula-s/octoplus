/**
 * AWS Lambda handler for Octoplus Caffe Nero voucher claiming
 *
 * Flow:
 * 1. Fetch credentials from SSM
 * 2. Check DynamoDB state - if valid voucher exists, send email if needed, stop
 * 3. Try to claim from Octopus API
 *    - canClaim=true  -> claim, save state, send email
 *    - OUT_OF_STOCK   -> stop (Lambda retries in 10 min)
 *    - MAX_CLAIMS_PER_PERIOD_REACHED -> fetch existing voucher, validate expiry, save & email
 *    - other          -> stop with error log
 */

import { ScheduledEvent, AccountState, AccountCredentials, VoucherInfo } from './src/types';
import { getAccountCredentials } from './src/services/parameters';
import { getState, saveState, getNextSundayMidnight } from './src/services/state';
import { sendVoucherEmail } from './src/services/email';
import { checkCaffeNeroOffer, claimCaffeNero, fetchLatestCaffeNeroVoucher } from './index';
import { OctopusAccount } from './accounts';

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
 * Mark state as emailSent=true and persist, then attempt to send the email.
 * Saves state first to prevent duplicate emails if the Lambda crashes after sending.
 * Returns the updated state.
 */
async function markSentAndEmail(
  credentials: AccountCredentials,
  voucher: VoucherInfo,
  state: AccountState
): Promise<AccountState> {
  const updated = { ...state, emailSent: true };
  await saveState(updated);

  try {
    const voucherWithNickname: VoucherInfo = {
      ...voucher,
      nickname: credentials.nickname,
    };
    console.log(`[Lambda] Sending email to ${credentials.emails.length} recipient(s)...`);
    await sendVoucherEmail(credentials.emails, voucherWithNickname);
    console.log(`[Lambda] Email sent successfully`);
  } catch (emailError) {
    console.error(`[Lambda] CRITICAL: Email send failed after state marked as sent. Manual check needed.`, emailError);
  }

  return updated;
}

/**
 * Mark state as emailSent=true when no email recipients are configured.
 * Returns the updated state.
 */
async function markSentNoEmail(state: AccountState): Promise<AccountState> {
  console.log(`[Lambda] No email configured - marking as sent`);
  const updated = { ...state, emailSent: true };
  await saveState(updated);
  return updated;
}

/**
 * Build an AccountState object for a newly obtained voucher.
 */
function buildState(accountNumber: string, voucher: VoucherInfo): AccountState {
  const now = Date.now();
  const expiresAt = getNextSundayMidnight(now);
  // TTL: 30 days from now (in seconds for DynamoDB)
  const ttl = Math.floor(now / 1000) + 30 * 24 * 60 * 60;

  return {
    accountNumber,
    voucherCode: voucher.code,
    barcode: voucher.barcode,
    expiresAt,
    claimedAt: now,
    emailSent: false,
    ttl,
  };
}

/**
 * Lambda handler entry point
 */
export const handler = async (
  event: ScheduledEvent,
  context: LambdaContext
): Promise<LambdaResponse> => {
  const startTime = Date.now();
  const requestId = context.requestId;

  console.log('='.repeat(80));
  console.log('LAMBDA START | Octoplus Caffe Nero Auto-Claimer');
  console.log('='.repeat(80));
  console.log(`Request ID:     ${requestId}`);
  console.log(`Start Time:     ${new Date(startTime).toISOString()}`);
  console.log(`Account Number: ${event.accountNumber}`);
  console.log('='.repeat(80));

  try {
    if (!event.accountNumber) {
      throw new Error('Missing accountNumber in event payload');
    }

    // ── Step 1: Fetch credentials from SSM ──────────────────────────────
    console.log('\n--- STEP 1: Fetch Credentials ---');
    const credentials = await getAccountCredentials(event.accountNumber);
    const octopusAccountNumber = credentials.accountNumber;
    console.log(`Credentials loaded for ${octopusAccountNumber}`);

    // ── Step 2: Check DynamoDB state ────────────────────────────────────
    console.log('\n--- STEP 2: Check DynamoDB State ---');
    const existingState = await getState(octopusAccountNumber);
    const now = Date.now();

    if (existingState && existingState.expiresAt > now) {
      // We have a valid (non-expired) voucher
      console.log(`[Lambda] Valid voucher exists: ${existingState.voucherCode} (expires ${new Date(existingState.expiresAt).toISOString()})`);

      if (existingState.emailSent) {
        console.log(`[Lambda] Email already sent - nothing to do`);
        return respond(200, {
          success: true,
          action: 'none',
          reason: 'Valid voucher exists and email already sent',
          accountNumber: octopusAccountNumber,
          voucherCode: existingState.voucherCode,
        }, startTime, requestId);
      }

      // Email not sent yet - send it now
      if (credentials.emails.length > 0) {
        const voucher: VoucherInfo = {
          code: existingState.voucherCode,
          barcode: existingState.barcode,
          accountNumber: octopusAccountNumber,
        };
        await markSentAndEmail(credentials, voucher, existingState);
      } else {
        await markSentNoEmail(existingState);
      }

      return respond(200, {
        success: true,
        action: 'email_sent',
        accountNumber: octopusAccountNumber,
        voucherCode: existingState.voucherCode,
      }, startTime, requestId);
    }

    // No valid voucher - need to claim
    console.log(`[Lambda] No valid voucher in DynamoDB - proceeding to claim`);

    // ── Step 3: Try to claim ────────────────────────────────────────────
    console.log('\n--- STEP 3: Claim from Octopus API ---');
    const account: OctopusAccount = {
      name: octopusAccountNumber,
      apiKey: credentials.apiKey,
      accountNumber: octopusAccountNumber,
    };

    const offerStatus = await checkCaffeNeroOffer(account);

    if (!offerStatus.found) {
      console.log(`[Lambda] Caffe Nero offer not found in benefits list`);
      return respond(200, {
        success: false,
        action: 'offer_not_found',
        accountNumber: octopusAccountNumber,
      }, startTime, requestId);
    }

    if (offerStatus.canClaim) {
      // ── Claim it ──────────────────────────────────────────────────
      console.log(`[Lambda] Offer is claimable - claiming...`);
      const claimResult = await claimCaffeNero(account);
      const voucher = claimResult.voucher;

      console.log(`[Lambda] Claimed voucher: ${voucher.code}`);

      // Save state then send email
      let state = buildState(octopusAccountNumber, voucher);
      if (credentials.emails.length > 0) {
        state = await markSentAndEmail(credentials, voucher, state);
      } else {
        state = await markSentNoEmail(state);
      }

      return respond(200, {
        success: true,
        action: 'claimed',
        accountNumber: octopusAccountNumber,
        voucherCode: voucher.code,
        emailSent: state.emailSent,
      }, startTime, requestId);
    }

    // ── Cannot claim - check reason ─────────────────────────────────
    const reason = offerStatus.cannotClaimReason || 'UNKNOWN';
    console.log(`[Lambda] Cannot claim. Reason: ${reason}`);

    if (reason === 'OUT_OF_STOCK' || reason === 'MAX_CLAIMS_PER_PERIOD_REACHED') {
      // Both cases: check if there's an existing voucher we can recover.
      // OUT_OF_STOCK may be returned even when the user already claimed
      // (the API doesn't distinguish "you claimed + it's out" from "just out").
      // MAX_CLAIMS means definitely claimed on Octopus but not in our DynamoDB.
      console.log(`[Lambda] ${reason} - checking for existing voucher...`);
      const fetched = await fetchLatestCaffeNeroVoucher(account);

      if (!fetched.voucher) {
        if (reason === 'OUT_OF_STOCK') {
          console.log(`[Lambda] No existing voucher found - will retry on next schedule`);
          return respond(200, {
            success: false,
            action: 'out_of_stock',
            accountNumber: octopusAccountNumber,
          }, startTime, requestId);
        }
        console.log(`[Lambda] No voucher found from API`);
        return respond(200, {
          success: false,
          action: 'max_claims_no_voucher',
          accountNumber: octopusAccountNumber,
        }, startTime, requestId);
      }

      // Validate expiry - never use an expired voucher
      const voucherExpiresAt = fetched.voucher.expiresAt
        ? new Date(fetched.voucher.expiresAt).getTime()
        : 0;

      if (voucherExpiresAt <= now) {
        console.log(`[Lambda] Fetched voucher is expired (${fetched.voucher.expiresAt}) - discarding`);
        if (reason === 'OUT_OF_STOCK') {
          return respond(200, {
            success: false,
            action: 'out_of_stock',
            accountNumber: octopusAccountNumber,
          }, startTime, requestId);
        }
        return respond(200, {
          success: false,
          action: 'voucher_expired',
          accountNumber: octopusAccountNumber,
        }, startTime, requestId);
      }

      console.log(`[Lambda] Valid existing voucher: ${fetched.voucher.code} (expires ${fetched.voucher.expiresAt})`);

      // Save state then send email
      let state = buildState(octopusAccountNumber, fetched.voucher);
      if (credentials.emails.length > 0) {
        state = await markSentAndEmail(credentials, fetched.voucher, state);
      } else {
        state = await markSentNoEmail(state);
      }

      return respond(200, {
        success: true,
        action: 'recovered_existing',
        accountNumber: octopusAccountNumber,
        voucherCode: fetched.voucher.code,
        emailSent: state.emailSent,
      }, startTime, requestId);
    }

    // Unknown reason
    console.error(`[Lambda] Unexpected cannotClaimReason: ${reason}`);
    return respond(200, {
      success: false,
      action: 'cannot_claim',
      reason,
      accountNumber: octopusAccountNumber,
    }, startTime, requestId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[Lambda] FAILURE: ${errorMessage}`);
    if (errorStack) console.error(errorStack);

    return respond(500, {
      success: false,
      error: errorMessage,
      accountNumber: event.accountNumber,
    }, startTime, requestId);
  }
};

function respond(
  statusCode: number,
  data: Record<string, unknown>,
  startTime: number,
  requestId: string
): LambdaResponse {
  const executionTime = Date.now() - startTime;
  const body = {
    ...data,
    executionTime: `${executionTime}ms`,
    timestamp: new Date().toISOString(),
    requestId,
  };

  console.log('');
  console.log('='.repeat(80));
  console.log(`LAMBDA END | ${statusCode === 200 ? 'SUCCESS' : 'FAILURE'} | ${executionTime}ms`);
  console.log(JSON.stringify(body, null, 2));
  console.log('='.repeat(80));

  return {
    statusCode,
    body: JSON.stringify(body, null, 2),
  };
}
