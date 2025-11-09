/**
 * Migration script to consolidate SSM parameters
 *
 * This script migrates from the old structure:
 *   /octoplus/{stage}/account-{N}/api-key
 *   /octoplus/{stage}/account-{N}/account-number
 *   /octoplus/{stage}/account-{N}/email
 *
 * To the new consolidated structure:
 *   /octoplus/{stage}/account-{N}/config (JSON)
 *
 * Usage:
 *   npm run build
 *   AWS_REGION=eu-west-1 STAGE=dev node dist/scripts/migrate-parameters.js
 *
 * Options:
 *   --dry-run: Show what would be migrated without making changes
 *   --delete-old: Delete old parameters after successful migration
 *   --accounts: Comma-separated list of account numbers (default: 1,2,3)
 */

import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';

const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const STAGE = process.env.STAGE || 'dev';
const SSM_PATH_PREFIX = process.env.SSM_PATH_PREFIX || `/octoplus/${STAGE}`;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldDeleteOld = args.includes('--delete-old');
const accountsArg = args.find(arg => arg.startsWith('--accounts='));
const accountNumbers = accountsArg
  ? accountsArg.split('=')[1].split(',').map(n => n.trim())
  : ['1', '2', '3'];

const ssmClient = new SSMClient({ region: AWS_REGION });

interface OldParameters {
  apiKey: string;
  accountNumber: string;
  email?: string;
}

interface NewConfig {
  apiKey: string;
  accountNumber: string;
  nickname: string;
  emails: string[];
}

/**
 * Fetch a parameter from SSM
 */
async function getParameter(name: string, withDecryption: boolean = true): Promise<string | undefined> {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption,
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error: any) {
    if (error.name === 'ParameterNotFound') {
      return undefined;
    }
    throw error;
  }
}

/**
 * Put a parameter to SSM
 */
async function putParameter(name: string, value: string, isSecure: boolean = true): Promise<void> {
  const command = new PutParameterCommand({
    Name: name,
    Value: value,
    Type: isSecure ? 'SecureString' : 'String',
    Overwrite: true,
  });
  await ssmClient.send(command);
}

/**
 * Delete a parameter from SSM
 */
async function deleteParameter(name: string): Promise<void> {
  const command = new DeleteParameterCommand({
    Name: name,
  });
  await ssmClient.send(command);
}

/**
 * Fetch old parameters for an account
 */
async function fetchOldParameters(accountNumber: string): Promise<OldParameters | null> {
  const accountPath = `${SSM_PATH_PREFIX}/account-${accountNumber}`;

  console.log(`\nFetching old parameters for account ${accountNumber}...`);

  const apiKey = await getParameter(`${accountPath}/api-key`, true);
  const octopusAccountNumber = await getParameter(`${accountPath}/account-number`, false);
  const email = await getParameter(`${accountPath}/email`, false);

  if (!apiKey) {
    console.log(`  ⚠️  No api-key found - skipping account ${accountNumber}`);
    return null;
  }

  if (!octopusAccountNumber) {
    console.log(`  ⚠️  No account-number found - skipping account ${accountNumber}`);
    return null;
  }

  console.log(`  ✓ Found api-key: ${apiKey.substring(0, 12)}...`);
  console.log(`  ✓ Found account-number: ${octopusAccountNumber}`);
  if (email) {
    console.log(`  ✓ Found email: ${email}`);
  } else {
    console.log(`  ℹ️  No email configured`);
  }

  return {
    apiKey,
    accountNumber: octopusAccountNumber,
    email,
  };
}

/**
 * Create new consolidated config
 */
function createNewConfig(old: OldParameters, accountNumber: string): NewConfig {
  // Parse emails from comma-separated string
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = old.email
    ? old.email.split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0 && emailRegex.test(e))
    : [];

  return {
    apiKey: old.apiKey,
    accountNumber: old.accountNumber,
    nickname: `Account ${accountNumber}`, // Default nickname
    emails,
  };
}

/**
 * Migrate a single account
 */
async function migrateAccount(accountNumber: string): Promise<boolean> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Migrating Account ${accountNumber}`);
  console.log('='.repeat(80));

  // Fetch old parameters
  const oldParams = await fetchOldParameters(accountNumber);
  if (!oldParams) {
    return false;
  }

  // Create new config
  const newConfig = createNewConfig(oldParams, accountNumber);

  console.log('\nNew consolidated config:');
  console.log(JSON.stringify(newConfig, null, 2));

  const configPath = `${SSM_PATH_PREFIX}/account-${accountNumber}/config`;

  if (isDryRun) {
    console.log(`\n[DRY RUN] Would create parameter: ${configPath}`);
    if (shouldDeleteOld) {
      console.log('[DRY RUN] Would delete old parameters:');
      console.log(`  - ${SSM_PATH_PREFIX}/account-${accountNumber}/api-key`);
      console.log(`  - ${SSM_PATH_PREFIX}/account-${accountNumber}/account-number`);
      console.log(`  - ${SSM_PATH_PREFIX}/account-${accountNumber}/email`);
    }
  } else {
    // Create new consolidated parameter
    console.log(`\nCreating consolidated parameter: ${configPath}`);
    await putParameter(configPath, JSON.stringify(newConfig), true);
    console.log('✓ Created successfully');

    // Delete old parameters if requested
    if (shouldDeleteOld) {
      console.log('\nDeleting old parameters...');
      const oldPaths = [
        `${SSM_PATH_PREFIX}/account-${accountNumber}/api-key`,
        `${SSM_PATH_PREFIX}/account-${accountNumber}/account-number`,
        `${SSM_PATH_PREFIX}/account-${accountNumber}/email`,
      ];

      for (const path of oldPaths) {
        try {
          await deleteParameter(path);
          console.log(`  ✓ Deleted: ${path}`);
        } catch (error: any) {
          if (error.name === 'ParameterNotFound') {
            console.log(`  ℹ️  Already deleted or not found: ${path}`);
          } else {
            console.error(`  ❌ Failed to delete ${path}:`, error.message);
          }
        }
      }
    }
  }

  return true;
}

/**
 * Main migration function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('SSM Parameter Migration Script');
  console.log('='.repeat(80));
  console.log(`Region: ${AWS_REGION}`);
  console.log(`Stage: ${STAGE}`);
  console.log(`Path Prefix: ${SSM_PATH_PREFIX}`);
  console.log(`Accounts: ${accountNumbers.join(', ')}`);
  console.log(`Dry Run: ${isDryRun ? 'YES' : 'NO'}`);
  console.log(`Delete Old: ${shouldDeleteOld ? 'YES' : 'NO'}`);
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  let successCount = 0;
  let failureCount = 0;

  for (const accountNumber of accountNumbers) {
    try {
      const success = await migrateAccount(accountNumber);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      console.error(`\n❌ Error migrating account ${accountNumber}:`, error);
      failureCount++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('Migration Summary');
  console.log('='.repeat(80));
  console.log(`✓ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('\n💡 To perform the actual migration, run without --dry-run');
    console.log('💡 To delete old parameters after migration, add --delete-old');
  } else if (!shouldDeleteOld) {
    console.log('\n💡 Old parameters are still present. To delete them, run with --delete-old');
  }

  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
