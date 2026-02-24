/**
 * DynamoDB state management service
 *
 * Simple state tracking per account: stores the current voucher code,
 * its expiry, and whether the email has been sent.
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
 * Calculate next Sunday at midnight UTC from the given timestamp.
 *
 * If it's already Sunday 00:00:00.000 UTC exactly, returns the *following* Sunday
 * so that a voucher claimed on Sunday always gets a full week.
 *
 * @param fromMs - Unix ms timestamp to calculate from (defaults to now)
 * @returns Unix ms for the upcoming Sunday 00:00:00 UTC
 */
export function getNextSundayMidnight(fromMs: number = Date.now()): number {
  const date = new Date(fromMs);
  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSunday = day === 0 ? 7 : 7 - day;

  const sunday = new Date(date);
  sunday.setUTCDate(date.getUTCDate() + daysUntilSunday);
  sunday.setUTCHours(0, 0, 0, 0);

  return sunday.getTime();
}

/**
 * Get account state from DynamoDB
 *
 * @param accountNumber - Octopus account number (e.g., "A-12345678")
 * @returns Account state if exists, undefined otherwise
 */
export async function getState(accountNumber: string): Promise<AccountState | undefined> {
  console.log(`[State] Fetching state for account ${accountNumber}`);

  try {
    const command = new GetCommand({
      TableName: getTableName(),
      Key: { accountNumber },
    });

    const response = await docClient.send(command);

    if (!response.Item) {
      console.log(`[State] No state found for account ${accountNumber}`);
      return undefined;
    }

    const state = response.Item as AccountState;
    console.log(`[State] Found state for account ${accountNumber}:`, {
      voucherCode: state.voucherCode,
      expiresAt: new Date(state.expiresAt).toISOString(),
      claimedAt: new Date(state.claimedAt).toISOString(),
      emailSent: state.emailSent,
    });

    return state;
  } catch (error) {
    console.error(`[State] Error fetching state for account ${accountNumber}:`, error);
    throw new Error(`Failed to fetch account state: ${error}`);
  }
}

/**
 * Save account state to DynamoDB
 *
 * @param state - Full account state to persist
 */
export async function saveState(state: AccountState): Promise<void> {
  console.log(`[State] Saving state for account ${state.accountNumber}:`, {
    voucherCode: state.voucherCode,
    barcode: state.barcode,
    expiresAt: new Date(state.expiresAt).toISOString(),
    claimedAt: new Date(state.claimedAt).toISOString(),
    emailSent: state.emailSent,
  });

  try {
    const command = new PutCommand({
      TableName: getTableName(),
      Item: state,
    });

    await docClient.send(command);
    console.log(`[State] Successfully saved state for account ${state.accountNumber}`);
  } catch (error) {
    console.error(`[State] Error saving state for account ${state.accountNumber}:`, error);
    throw new Error(`Failed to save account state: ${error}`);
  }
}
