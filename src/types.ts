/**
 * Type definitions for Octoplus application
 */

// ============================================================================
// EventBridge & Lambda
// ============================================================================

/**
 * Event payload received from EventBridge scheduled event
 */
export interface ScheduledEvent {
  accountNumber: string;
}

// ============================================================================
// Account Credentials (from SSM Parameter Store)
// ============================================================================

/**
 * Account credentials fetched from SSM Parameter Store
 */
export interface AccountCredentials {
  /** Octopus Energy account number (e.g., "A-12345678") */
  accountNumber: string;
  /** Octopus Energy API key (e.g., "sk_live_...") */
  apiKey: string;
  /** Optional email address(es) for notifications (comma-separated if multiple) */
  email?: string;
  /** Parsed email addresses as array */
  emails: string[];
}

// ============================================================================
// DynamoDB State Management
// ============================================================================

/**
 * Account state stored in DynamoDB
 */
export interface AccountState {
  /** Partition key: Octopus account number */
  accountNumber: string;
  /** Last claimed voucher code */
  voucherCode?: string;
  /** Timestamp when email was sent (Unix milliseconds) */
  emailSentAt?: number;
  /** Timestamp when voucher was last claimed (Unix milliseconds) */
  lastClaimedAt?: number;
  /** TTL for automatic cleanup (Unix seconds) */
  ttl?: number;
}

// ============================================================================
// Email Service
// ============================================================================

/**
 * Options for sending an email with QR code
 */
export interface EmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML email body */
  htmlBody: string;
  /** QR code as PNG buffer */
  qrCodeBuffer: Buffer;
  /** QR code filename for attachment */
  qrCodeFileName: string;
}

/**
 * Voucher information for email template
 */
export interface VoucherInfo {
  /** Voucher code for the coffee */
  code: string;
  /** Barcode value to generate QR from */
  barcode: string;
  /** Expiration date of the voucher */
  expiresAt?: string;
  /** Account number this voucher belongs to */
  accountNumber: string;
}

// ============================================================================
// Octopus API
// ============================================================================

/**
 * Result of attempting to claim a voucher
 */
export interface ClaimResult {
  /** Whether the claim was successful */
  success: boolean;
  /** Voucher information if successful */
  voucher?: VoucherInfo;
  /** Error message if unsuccessful */
  error?: string;
  /** Whether the voucher was already claimed */
  alreadyClaimed?: boolean;
}

/**
 * Partner offer group from Octopus API
 */
export interface PartnerOfferGroup {
  __typename: string;
  title: string;
  slug: string;
  offers: PartnerOffer[];
}

/**
 * Individual partner offer
 */
export interface PartnerOffer {
  __typename: string;
  title: string;
  slug: string;
  description?: string;
}

/**
 * Claimed Octoplus reward
 */
export interface OctoplusReward {
  __typename: string;
  partnerOfferSlug: string;
  voucherCode?: string;
  barcode?: string;
  expiresAt?: string;
  claimedAt?: string;
}

/**
 * Kraken token for API authentication
 */
export interface KrakenToken {
  token: string;
  expiresAt: string;
}

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** DynamoDB table name for state storage */
  STATE_TABLE_NAME: string;
  /** SSM Parameter Store path prefix (e.g., "/octoplus/dev") */
  SSM_PATH_PREFIX: string;
  /** Deployment stage (dev, prod, etc.) */
  STAGE: string;
  /** AWS region */
  AWS_REGION?: string;
}
