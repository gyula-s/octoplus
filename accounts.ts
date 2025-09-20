// accounts.ts
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

export interface OctopusAccount {
  apiKey: string;
  accountNumber: string;
  name: string;
}

/**
 * Load all configured Octopus accounts from environment variables
 * Supports both numbered accounts (OCTOPUS_API_KEY_1, etc.) and legacy format
 */
export function loadOctopusAccounts(): OctopusAccount[] {
  const accounts: OctopusAccount[] = [];

  // Check for numbered accounts (OCTOPUS_API_KEY_1, OCTOPUS_API_KEY_2, etc.)
  let accountIndex = 1;
  while (true) {
    const apiKey = process.env[`OCTOPUS_API_KEY_${accountIndex}`];
    const accountNumber = process.env[`OCTOPUS_ACCOUNT_NUMBER_${accountIndex}`];

    if (!apiKey || !accountNumber) {
      break; // No more numbered accounts
    }

    accounts.push({
      apiKey,
      accountNumber,
      name: `Account ${accountIndex}`
    });

    accountIndex++;
  }

  // Check for legacy format (single account)
  const legacyApiKey = process.env.OCTOPUS_API_KEY;
  const legacyAccountNumber = process.env.OCTOPUS_ACCOUNT_NUMBER;

  if (legacyApiKey && legacyAccountNumber) {
    // Only add legacy if no numbered accounts were found
    if (accounts.length === 0) {
      accounts.push({
        apiKey: legacyApiKey,
        accountNumber: legacyAccountNumber,
        name: 'Main Account'
      });
    }
  }

  // Validate we have at least one account
  if (accounts.length === 0) {
    throw new Error(`
❌ No Octopus accounts configured!

Please configure at least one account in your .env file:

For single account:
OCTOPUS_API_KEY=your_api_key_here
OCTOPUS_ACCOUNT_NUMBER=A-XXXXXXXX

For multiple accounts:
OCTOPUS_API_KEY_1=your_api_key_here
OCTOPUS_ACCOUNT_NUMBER_1=A-XXXXXXXX
OCTOPUS_API_KEY_2=friends_api_key_here
OCTOPUS_ACCOUNT_NUMBER_2=A-YYYYYYYY
    `);
  }

  return accounts;
}

/**
 * Validate that all account configurations are properly formatted
 */
export function validateAccounts(accounts: OctopusAccount[]): void {
  for (const account of accounts) {
    // Validate API key format
    if (!account.apiKey.startsWith('sk_')) {
      throw new Error(`❌ Invalid API key format for ${account.name}: ${account.apiKey}. Expected format: sk_live_...`);
    }

    // Validate account number format
    if (!account.accountNumber.match(/^A-[A-Z0-9]{8}$/)) {
      throw new Error(`❌ Invalid account number format for ${account.name}: ${account.accountNumber}. Expected format: A-XXXXXXXX`);
    }
  }

  console.log(`✅ ${accounts.length} Octopus account(s) configured and validated`);
  for (const account of accounts) {
    const maskedApiKey = account.apiKey.substring(0, 7) + '...' + account.apiKey.slice(-4);
    console.log(`   • ${account.name}: ${account.accountNumber} (${maskedApiKey})`);
  }
}