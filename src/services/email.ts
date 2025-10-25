/**
 * Email service with QR code generation
 *
 * Generates QR codes from barcodes and sends emails via AWS SES
 */

import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import * as QRCode from 'qrcode';
import { VoucherInfo, EmailOptions } from '../types';

// Initialize SES client (reused across warm Lambda invocations)
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'eu-west-1',
});

// SES sender email (verified in AWS SES)
const SES_SENDER_EMAIL = process.env.SES_SENDER_EMAIL;
if (!SES_SENDER_EMAIL) {
  throw new Error('SES_SENDER_EMAIL environment variable is not set');
}

/**
 * Generate QR code as PNG buffer from barcode string
 *
 * @param barcodeValue - The barcode value to encode in QR code
 * @returns PNG buffer
 */
async function generateQRCodePNG(barcodeValue: string): Promise<Buffer> {
  console.log(`[Email] Generating QR code for barcode: ${barcodeValue}`);

  try {
    const buffer = await QRCode.toBuffer(barcodeValue, {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    console.log(`[Email] QR code generated successfully (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error('[Email] Error generating QR code:', error);
    throw new Error(`Failed to generate QR code: ${error}`);
  }
}

/**
 * Create HTML email body with voucher information
 *
 * @param voucher - Voucher information
 * @returns HTML email body
 */
function createEmailHTML(voucher: VoucherInfo): string {
  const expiresText = voucher.expiresAt
    ? `<p><strong>Expires:</strong> ${new Date(voucher.expiresAt).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}</p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Caffe Nero Voucher</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a1a; margin: 0 0 10px 0; font-size: 28px;">☕ Your Caffe Nero Voucher</h1>
      <p style="color: #666; margin: 0; font-size: 14px;">Weekly reward from Octopus Energy Octoplus</p>
    </div>

    <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
      <h2 style="margin-top: 0; color: #1a1a1a; font-size: 18px;">Voucher Details</h2>
      <p style="margin: 10px 0;"><strong>Code:</strong> <span style="font-family: 'Courier New', monospace; font-size: 18px; color: #0066cc;">${voucher.code}</span></p>
      ${expiresText}
      <p style="margin: 10px 0;"><strong>Account:</strong> ${voucher.accountNumber}</p>
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <h3 style="color: #1a1a1a; margin-bottom: 15px; font-size: 16px;">Scan QR Code at Store</h3>
      <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Show this QR code to the barista</p>
      <div style="background-color: #ffffff; display: inline-block; padding: 15px; border: 2px solid #e9ecef; border-radius: 8px;">
        <img src="cid:qrcode" alt="QR Code" style="display: block; width: 250px; height: 250px;" />
      </div>
    </div>

    <div style="background-color: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>💡 Tip:</strong> Screenshot this email or save the QR code image to your photos for easy access at the coffee shop.
      </p>
    </div>

    <div style="border-top: 1px solid #e9ecef; padding-top: 20px; margin-top: 30px;">
      <h4 style="color: #1a1a1a; margin-bottom: 10px; font-size: 14px;">How to Redeem:</h4>
      <ol style="color: #666; font-size: 14px; line-height: 1.8; padding-left: 20px;">
        <li>Visit any participating Caffe Nero store</li>
        <li>Order your drink at the counter</li>
        <li>Show the QR code above to the barista</li>
        <li>They'll scan it and apply your reward</li>
        <li>Enjoy your free coffee! ☕</li>
      </ol>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
      <p style="color: #999; font-size: 12px; margin: 5px 0;">
        Automatically claimed via Octopus Energy Octoplus
      </p>
      <p style="color: #999; font-size: 12px; margin: 5px 0;">
        Generated on ${new Date().toLocaleDateString('en-GB', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Create RFC 2822 compliant raw email message with attachment
 *
 * @param options - Email options
 * @returns Raw email as string
 */
function createRawEmail(options: EmailOptions): string {
  const boundary = '----=_Part_0_' + Date.now() + Math.random().toString(36);
  const qrCodeBase64 = options.qrCodeBuffer.toString('base64');

  // Split base64 into 76-character lines (RFC 2045)
  const qrCodeLines = qrCodeBase64.match(/.{1,76}/g)?.join('\r\n') || qrCodeBase64;

  const rawEmail = [
    `From: ${SES_SENDER_EMAIL}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    options.htmlBody,
    '',
    `--${boundary}`,
    'Content-Type: image/png; name="' + options.qrCodeFileName + '"',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <qrcode>',
    'Content-Disposition: inline; filename="' + options.qrCodeFileName + '"',
    '',
    qrCodeLines,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  return rawEmail;
}

/**
 * Send voucher email with QR code via AWS SES
 *
 * @param recipientEmails - Recipient email address(es) - can be string or array
 * @param voucher - Voucher information
 * @throws Error if email sending fails
 */
export async function sendVoucherEmail(recipientEmails: string | string[], voucher: VoucherInfo): Promise<void> {
  // Normalize to array
  const recipients = Array.isArray(recipientEmails) ? recipientEmails : [recipientEmails];

  console.log(`[Email] Preparing to send voucher email to ${recipients.length} recipient(s)`);
  console.log(`[Email] Recipients: ${recipients.join(', ')}`);
  console.log(`[Email] Voucher code: ${voucher.code}, Account: ${voucher.accountNumber}`);

  try {
    // Generate QR code
    const qrCodeBuffer = await generateQRCodePNG(voucher.barcode);

    // Create email HTML
    const htmlBody = createEmailHTML(voucher);

    // Create email options (use first recipient in To: header)
    const emailOptions: EmailOptions = {
      to: recipients[0],
      subject: `☕ Your Caffe Nero Voucher - ${voucher.code}`,
      htmlBody,
      qrCodeBuffer,
      qrCodeFileName: `caffe-nero-qr-${voucher.code}.png`,
    };

    // Create raw email message
    const rawMessage = createRawEmail(emailOptions);

    // Send via SES to all recipients
    console.log(`[Email] Sending email via AWS SES to ${recipients.length} recipient(s)...`);
    const command = new SendRawEmailCommand({
      Source: SES_SENDER_EMAIL,
      Destinations: recipients,  // SES supports multiple destinations
      RawMessage: {
        Data: Buffer.from(rawMessage),
      },
    });

    const response = await sesClient.send(command);
    console.log(`[Email] ✓ Email sent successfully! MessageId: ${response.MessageId}`);
    console.log(`[Email] ✓ Delivered to: ${recipients.join(', ')}`);
  } catch (error) {
    console.error('[Email] Failed to send email:', error);

    // Check for common SES errors
    if (error instanceof Error) {
      if (error.message.includes('Email address is not verified')) {
        console.error('[Email] ERROR: Email address not verified in AWS SES.');
        console.error('[Email] Please verify both sender and recipient emails in SES console.');
        console.error('[Email] See DEPLOYMENT.md for instructions.');
      } else if (error.message.includes('Daily sending quota exceeded')) {
        console.error('[Email] ERROR: SES daily sending quota exceeded.');
      } else if (error.message.includes('Account is in sandbox mode')) {
        console.error('[Email] ERROR: SES is in sandbox mode. Only verified emails can receive messages.');
      }
    }

    throw new Error(`Failed to send email: ${error}`);
  }
}

/**
 * Send test email (useful for verifying SES setup)
 *
 * @param recipientEmail - Recipient email address
 */
export async function sendTestEmail(recipientEmail: string): Promise<void> {
  console.log(`[Email] Sending test email to ${recipientEmail}`);

  const testVoucher: VoucherInfo = {
    code: 'TEST123',
    barcode: '1234567890',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accountNumber: 'A-TEST1234',
  };

  await sendVoucherEmail(recipientEmail, testVoucher);
}
