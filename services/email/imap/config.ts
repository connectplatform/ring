/**
 * Email Configuration for info@ringdom.org
 * =========================================
 * Configuration loaded from environment variables
 * Secrets stored in: .cursor/.secrets/legion/ring-ringdom-org-secrets.json
 */

export interface EmailConfig {
  // IMAP settings for receiving
  host: string;
  port: number;
  tls: boolean;
  tlsRejectUnauthorized: boolean;
  user: string;
  password: string;
  
  // SMTP settings for sending
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  
  // Processing settings
  polling: {
    interval: number; // Fallback polling interval in ms
    batchSize: number; // Max emails to process at once
  };
  
  // Mailbox settings
  mailbox: string;
  processedFolder: string;
  spamFolder: string;
}

// Environment-based configuration with secure defaults
export const emailConfig: EmailConfig = {
  // IMAP settings (IMAPS)
  host: process.env.IMAP_HOST || 'mail.ringdom.org',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  tls: process.env.IMAP_TLS !== 'false',
  tlsRejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false',
  user: process.env.IMAP_USER || 'info@ringdom.org',
  password: process.env.IMAP_PASSWORD || '', // Must be set via env
  
  // SMTP settings for outgoing mail
  smtp: {
    host: process.env.SMTP_HOST || 'mail.ringdom.org',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // false for STARTTLS
    auth: {
      user: process.env.SMTP_USER || 'info@ringdom.org',
      pass: process.env.SMTP_PASSWORD || '', // Must be set via env
    },
  },
  
  // Processing settings
  polling: {
    interval: parseInt(process.env.EMAIL_POLLING_INTERVAL || '30000', 10), // 30 seconds
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10),
  },
  
  // Mailbox settings
  mailbox: process.env.EMAIL_MAILBOX || 'INBOX',
  processedFolder: process.env.EMAIL_PROCESSED_FOLDER || 'Processed',
  spamFolder: process.env.EMAIL_SPAM_FOLDER || 'Spam',
};

// Validation function
export function validateEmailConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!emailConfig.password) {
    errors.push('IMAP_PASSWORD environment variable is required');
  }
  
  if (!emailConfig.smtp.auth.pass) {
    errors.push('SMTP_PASSWORD environment variable is required');
  }
  
  if (!emailConfig.host) {
    errors.push('IMAP_HOST is required');
  }
  
  if (!emailConfig.smtp.host) {
    errors.push('SMTP_HOST is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export environment variable template for .env.local
export const envTemplate = `
# Email Configuration for ring-ringdom-org
# Copy to .env.local and fill in values

# IMAP Settings (for receiving emails)
IMAP_HOST=mail.ringdom.org
IMAP_PORT=993
IMAP_TLS=true
IMAP_TLS_REJECT_UNAUTHORIZED=false
IMAP_USER=info@ringdom.org
IMAP_PASSWORD=yrVPmVRniU3XKQKmj7Dz

# SMTP Settings (for sending emails)
SMTP_HOST=mail.ringdom.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@ringdom.org
SMTP_PASSWORD=yrVPmVRniU3XKQKmj7Dz

# Processing Settings
EMAIL_POLLING_INTERVAL=30000
EMAIL_BATCH_SIZE=10
EMAIL_MAILBOX=INBOX
EMAIL_PROCESSED_FOLDER=Processed
EMAIL_SPAM_FOLDER=Spam
`;

export default emailConfig;
