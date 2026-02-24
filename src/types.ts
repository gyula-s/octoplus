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
  /** Optional account nickname for personalization */
  nickname?: string;
  /** Email addresses for notifications */
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
  /** Current week's voucher code */
  voucherCode: string;
  /** Barcode value for QR code generation */
  barcode: string;
  /** Unix ms - when this voucher expires (always next Sunday midnight UTC) */
  expiresAt: number;
  /** Unix ms - when the voucher was claimed from Octopus */
  claimedAt: number;
  /** Whether email was sent for this voucher code */
  emailSent: boolean;
  /** TTL for automatic DynamoDB cleanup (Unix seconds) */
  ttl: number;
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
  /** Optional account nickname for personalization */
  nickname?: string;
}

// ============================================================================
// Octopus API
// ============================================================================

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
