/**
 * DynamoDB state tracking service with weekly reset logic
 *
 * Prevents duplicate API calls and emails by tracking claim state per account.
 * State automatically becomes stale after Saturday 9:00 AM UTC, allowing new claims.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { AccountState } from '../types';

// Initialize DynamoDB client (reused across warm Lambda invocations)
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * Get the DynamoDB table name from environment
 */
function getTableName(): string {
  const tableName = process.env.STATE_TABLE_NAME;
  if (!tableName) {
    throw new Error('STATE_TABLE_NAME environment variable is not set');
  }
  return tableName;
}

/**
 * Calculate the most recent Saturday at 9:00 AM UTC
 * This is the weekly reset boundary
 *
 * Logic:
 * - If today is Saturday and we're before 9 AM, use last Saturday
 * - If today is Saturday and we're after 9 AM, use today
 * - Otherwise, go back to the most recent Saturday
 *
 * @returns Date object representing the most recent Saturday at 9:00 AM UTC
 *
 * @example
 * // Monday Oct 21, 2025 10:00 AM UTC
 * getMostRecentSaturdayAt9AM() // Returns: Saturday Oct 19, 2025 9:00 AM UTC
 *
 * @example
 * // Saturday Oct 19, 2025 8:00 AM UTC (before reset)
 * getMostRecentSaturdayAt9AM() // Returns: Saturday Oct 12, 2025 9:00 AM UTC
 *
 * @example
 * // Saturday Oct 19, 2025 10:00 AM UTC (after reset)
 * getMostRecentSaturdayAt9AM() // Returns: Saturday Oct 19, 2025 9:00 AM UTC
 */
export function getMostRecentSaturdayAt9AM(): Date {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Calculate days since last Saturday
  let daysSinceSaturday: number;
  if (currentDay === 6) {
    // Today is Saturday
    daysSinceSaturday = 0;
  } else {
    // Calculate days back to Saturday (0-5 days)
    daysSinceSaturday = (currentDay + 1) % 7;
  }

  // Create date for most recent Saturday
  const lastSaturday = new Date(now);
  lastSaturday.setUTCDate(now.getUTCDate() - daysSinceSaturday);
  lastSaturday.setUTCHours(9, 0, 0, 0);

  // If we're before the reset time on Saturday, go back one more week
  if (now < lastSaturday) {
    lastSaturday.setUTCDate(lastSaturday.getUTCDate() - 7);
  }

  return lastSaturday;
}

/**
 * Get account state from DynamoDB
 *
 * @param accountNumber - Octopus account number (e.g., "A-12345678")
 * @returns Account state if exists, undefined otherwise
 */
export async function getAccountState(accountNumber: string): Promise<AccountState | undefined> {
  console.log(`[State] Fetching state for account ${accountNumber}`);

  try {
    const command = new GetCommand({
      TableName: getTableName(),
      Key: {
        accountNumber,
      },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      console.log(`[State] No state found for account ${accountNumber}`);
      return undefined;
    }

    const state = response.Item as AccountState;
    console.log(`[State] Found state for account ${accountNumber}:`, {
      voucherCode: state.voucherCode,
      lastClaimedAt: state.lastClaimedAt ? new Date(state.lastClaimedAt).toISOString() : undefined,
      emailSentAt: state.emailSentAt ? new Date(state.emailSentAt).toISOString() : undefined,
    });

    return state;
  } catch (error) {
    console.error(`[State] Error fetching state for account ${accountNumber}:`, error);
    throw new Error(`Failed to fetch account state: ${error}`);
  }
}

/**
 * Check if account should be skipped (already processed this week)
 *
 * Returns true if:
 * - State exists AND
 * - lastClaimedAt is after the most recent Saturday 9 AM UTC
 *
 * @param accountNumber - Octopus account number
 * @returns true if account should be skipped, false if it should be processed
 */
export async function shouldSkipAccount(accountNumber: string): Promise<boolean> {
  const state = await getAccountState(accountNumber);

  // No state means never claimed - process it
  if (!state || !state.lastClaimedAt) {
    console.log(`[State] No claim history for account ${accountNumber} - will process`);
    return false;
  }

  // Check if last claim is after most recent Saturday 9 AM
  const resetBoundary = getMostRecentSaturdayAt9AM();
  const lastClaimed = new Date(state.lastClaimedAt);

  console.log(`[State] Checking freshness for account ${accountNumber}:`);
  console.log(`  Reset boundary: ${resetBoundary.toISOString()}`);
  console.log(`  Last claimed:   ${lastClaimed.toISOString()}`);

  // If last claim is after reset boundary, state is fresh - skip
  if (lastClaimed > resetBoundary) {
    console.log(`[State] ✓ Account ${accountNumber} already processed this week - SKIP`);
    return true;
  }

  // Last claim is before reset boundary, state is stale - process
  console.log(`[State] ✗ Account ${accountNumber} state is stale - PROCESS`);
  return false;
}

/**
 * Check if email should be sent for a voucher code
 *
 * Logic:
 * - If FORCE_EMAIL_SEND=true: Always send email
 * - If FORCE_EMAIL_SEND=false: Only send if voucher code changed (new voucher)
 *
 * @param accountNumber - Octopus account number
 * @param currentVoucherCode - Current voucher code to check
 * @returns true if email should be sent, false otherwise
 */
export async function shouldSendEmail(accountNumber: string, currentVoucherCode: string): Promise<boolean> {
  const forceEmailSend = process.env.FORCE_EMAIL_SEND?.toLowerCase() === 'true';

  console.log(`[State] Email send mode: FORCE_EMAIL_SEND=${forceEmailSend ? 'true' : 'false'}`);

  // If force mode enabled, always send
  if (forceEmailSend) {
    console.log(`[State] ✓ FORCE_EMAIL_SEND=true - will send email`);
    return true;
  }

  // Check if we already sent email for this voucher code
  const state = await getAccountState(accountNumber);

  // No state means never sent - send it
  if (!state || !state.voucherCode) {
    console.log(`[State] ✓ No previous email record - will send email`);
    return true;
  }

  // Compare voucher codes
  if (state.voucherCode !== currentVoucherCode) {
    console.log(`[State] ✓ Voucher code changed (${state.voucherCode} → ${currentVoucherCode}) - will send email`);
    return true;
  }

  // Same voucher code - already sent email for this one
  console.log(`[State] ✗ Email already sent for voucher code ${currentVoucherCode} - will skip email`);
  return false;
}

/**
 * Save claim state to DynamoDB
 *
 * @param accountNumber - Octopus account number
 * @param voucherCode - Claimed voucher code
 * @param emailSent - Whether email was successfully sent
 */
export async function saveClaimState(
  accountNumber: string,
  voucherCode: string,
  emailSent: boolean = false
): Promise<void> {
  console.log(`[State] Saving claim state for account ${accountNumber}`);
  console.log(`  Voucher code: ${voucherCode}`);
  console.log(`  Email sent: ${emailSent}`);

  const now = Date.now();

  // Calculate TTL (30 days from now, in seconds)
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  const state: AccountState = {
    accountNumber,
    voucherCode,
    lastClaimedAt: now,
    emailSentAt: emailSent ? now : undefined,
    ttl,
  };

  try {
    const command = new PutCommand({
      TableName: getTableName(),
      Item: state,
    });

    await docClient.send(command);
    console.log(`[State] ✓ Successfully saved state for account ${accountNumber}`);
  } catch (error) {
    console.error(`[State] Error saving state for account ${accountNumber}:`, error);
    // Don't throw - saving state is not critical, we just log the error
    console.warn(`[State] Warning: Failed to save state, but continuing execution`);
  }
}

/**
 * Clear state for an account (useful for testing/manual reset)
 *
 * @param accountNumber - Octopus account number
 */
export async function clearAccountState(accountNumber: string): Promise<void> {
  console.log(`[State] Clearing state for account ${accountNumber}`);

  try {
    const command = new PutCommand({
      TableName: getTableName(),
      Item: {
        accountNumber,
        lastClaimedAt: 0,
        ttl: Math.floor(Date.now() / 1000) + 60, // Expire in 1 minute
      },
    });

    await docClient.send(command);
    console.log(`[State] ✓ Cleared state for account ${accountNumber}`);
  } catch (error) {
    console.error(`[State] Error clearing state for account ${accountNumber}:`, error);
    throw new Error(`Failed to clear account state: ${error}`);
  }
}

/**
 * Check if we're currently in the claim window (Monday 5:00-6:30 AM UTC)
 * This is informational only - the schedule controls actual execution
 *
 * @returns true if current time is in the claim window
 */
export function isInClaimWindow(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // Must be Monday (1)
  if (day !== 1) {
    return false;
  }

  // Must be between 5:00 and 6:30 AM UTC
  if (hour < 5 || hour > 6) {
    return false;
  }

  // If hour is 6, must be before 6:30
  if (hour === 6 && minute > 30) {
    return false;
  }

  return true;
}
