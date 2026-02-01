import { CONFIG } from './config';

export interface ScanResult {
  passed: boolean;
  issues: string[];
}

export function scanContent(
  content: string,
  options?: {
    minLength?: number;
    maxLength?: number;
    allowLinks?: boolean;
  }
): ScanResult {
  const issues: string[] = [];

  const minLength = options?.minLength ?? CONFIG.CONTENT.MIN_COMMENT_LENGTH;
  const maxLength = options?.maxLength ?? CONFIG.CONTENT.MAX_COMMENT_LENGTH;
  const allowLinks = options?.allowLinks ?? false; // Default to restrictive

  // PII Patterns
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex =
    /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  // Turkish phone numbers
  const turkishPhoneRegex = /\b0?5\d{2}[-.\s]?\d{3}[-.\s]?\d{2}[-.\s]?\d{2}\b/g;
  // Credit card pattern
  const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

  if (emailRegex.test(content)) {
    issues.push('Email address detected - PII not allowed');
  }

  if (phoneRegex.test(content) || turkishPhoneRegex.test(content)) {
    issues.push('Phone number detected - PII not allowed');
  }

  if (ssnRegex.test(content)) {
    issues.push('SSN-like pattern detected - PII not allowed');
  }

  if (ccRegex.test(content)) {
    issues.push('Credit card number pattern detected - PII not allowed');
  }

  // Link Detection
  if (!allowLinks) {
    const linkRegex = /https?:\/\/[^\s]+/gi;
    const wwwRegex = /www\.[^\s]+/gi;
    if (linkRegex.test(content) || wwwRegex.test(content)) {
      issues.push('Links are not allowed');
    }
  }

  // Length checks
  const trimmedContent = content.trim();
  if (trimmedContent.length < minLength) {
    issues.push(`Minimum ${minLength} characters required`);
  }
  if (trimmedContent.length > maxLength) {
    issues.push(`Maximum ${maxLength} characters allowed`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

export function scanPostContent(content: string): ScanResult {
  return scanContent(content, {
    minLength: 1,
    maxLength: CONFIG.CONTENT.MAX_POST_LENGTH,
    allowLinks: CONFIG.CONTENT.ALLOW_POST_LINKS,
  });
}

export function scanCommentContent(content: string): ScanResult {
  return scanContent(content, {
    minLength: CONFIG.CONTENT.MIN_COMMENT_LENGTH,
    maxLength: CONFIG.CONTENT.MAX_COMMENT_LENGTH,
    allowLinks: CONFIG.CONTENT.ALLOW_COMMENT_LINKS,
  });
}
