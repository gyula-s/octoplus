/**
 * AWS SSM Parameter Store service for fetching account credentials
 */

import { SSMClient, GetParameterCommand, GetParameterCommandInput } from '@aws-sdk/client-ssm';
import { AccountCredentials } from '../types';

// Initialize SSM client (reused across warm Lambda invocations)
const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'eu-west-1',
});

// In-memory cache for parameters (persists during Lambda warm starts)
const parameterCache: Map<string, { value: string; timestamp: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the SSM path prefix for the current stage
 */
function getPathPrefix(): string {
  const stage = process.env.STAGE || 'dev';
  const prefix = process.env.SSM_PATH_PREFIX || `/octoplus/${stage}`;
  return prefix;
}

/**
 * Fetch a single parameter from SSM Parameter Store with caching
 *
 * @param parameterName - Full path to the parameter
 * @param withDecryption - Whether to decrypt SecureString parameters
 * @returns Parameter value
 */
async function getParameter(
  parameterName: string,
  withDecryption: boolean = true
): Promise<string> {
  const cacheKey = `${parameterName}:${withDecryption}`;

  // Check cache
  const cached = parameterCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[SSM] Using cached parameter: ${parameterName}`);
    return cached.value;
  }

  console.log(`[SSM] Fetching parameter: ${parameterName}`);

  try {
    const input: GetParameterCommandInput = {
      Name: parameterName,
      WithDecryption: withDecryption,
    };

    const command = new GetParameterCommand(input);
    const response = await ssmClient.send(command);

    if (!response.Parameter?.Value) {
      throw new Error(`Parameter ${parameterName} not found or has no value`);
    }

    const value = response.Parameter.Value;

    // Cache the value
    parameterCache.set(cacheKey, {
      value,
      timestamp: Date.now(),
    });

    return value;
  } catch (error) {
    console.error(`[SSM] Error fetching parameter ${parameterName}:`, error);
    throw new Error(`Failed to fetch SSM parameter ${parameterName}: ${error}`);
  }
}

/**
 * Interface for the consolidated account configuration stored in SSM
 */
interface AccountConfig {
  apiKey: string;
  accountNumber: string;
  nickname?: string;
  emails: string[];
}

/**
 * Get account credentials from SSM Parameter Store
 *
 * Fetches a single consolidated JSON parameter:
 * - /octoplus/{stage}/account-{N}/config (JSON containing all account data)
 *
 * @param accountNumber - Account number identifier (e.g., "1", "2", "3")
 * @returns Account credentials
 * @throws Error if required parameters are missing
 *
 * @example
 * const credentials = await getAccountCredentials("1");
 * // Returns: { apiKey: "sk_live_...", accountNumber: "A-12345678", nickname: "My Account", emails: ["user@example.com"] }
 */
export async function getAccountCredentials(accountNumber: string): Promise<AccountCredentials> {
  console.log(`[SSM] Fetching credentials for account ${accountNumber}`);

  const pathPrefix = getPathPrefix();
  const configPath = `${pathPrefix}/account-${accountNumber}/config`;

  try {
    // Fetch the consolidated config parameter
    const configJson = await getParameter(configPath, true); // Decrypt SecureString

    // Parse JSON config
    let config: AccountConfig;
    try {
      config = JSON.parse(configJson);
    } catch (parseError) {
      throw new Error(`Invalid JSON format in config parameter: ${parseError}`);
    }

    // Validate required fields
    if (!config.apiKey) {
      throw new Error(`API key not found in config for account ${accountNumber}`);
    }

    if (!config.accountNumber) {
      throw new Error(`Account number not found in config for account ${accountNumber}`);
    }

    // Validate API key format
    if (!config.apiKey.startsWith('sk_')) {
      throw new Error(`Invalid API key format for account ${accountNumber} (must start with "sk_")`);
    }

    // Validate account number format
    if (!/^A-[A-Z0-9]{8}$/.test(config.accountNumber)) {
      throw new Error(`Invalid account number format for account ${accountNumber} (expected format: A-XXXXXXXX)`);
    }

    // Validate and filter email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = (config.emails || [])
      .map(e => e.trim())
      .filter(e => e.length > 0 && emailRegex.test(e));

    const credentials: AccountCredentials = {
      apiKey: config.apiKey,
      accountNumber: config.accountNumber,
      nickname: config.nickname,
      emails: validEmails,
    };

    console.log(`[SSM] Successfully fetched credentials for account ${accountNumber} (${credentials.accountNumber})`);
    if (credentials.nickname) {
      console.log(`[SSM] Nickname: ${credentials.nickname}`);
    }
    if (credentials.emails.length > 0) {
      console.log(`[SSM] Email(s) configured: ${credentials.emails.join(', ')}`);
      console.log(`[SSM] Total recipients: ${credentials.emails.length}`);
    } else {
      console.log(`[SSM] No email configured for account ${accountNumber}`);
    }

    return credentials;
  } catch (error) {
    console.error(`[SSM] Failed to fetch credentials for account ${accountNumber}:`, error);
    throw error;
  }
}

/**
 * Clear the parameter cache (useful for testing)
 */
export function clearParameterCache(): void {
  console.log('[SSM] Clearing parameter cache');
  parameterCache.clear();
}

/**
 * Get current cache size (useful for monitoring)
 */
export function getCacheSize(): number {
  return parameterCache.size;
}
