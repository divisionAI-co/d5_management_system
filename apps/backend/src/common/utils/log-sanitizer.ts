/**
 * Utility to sanitize logs and prevent secrets from being logged
 */

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'authorization',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'jwt_secret',
  'encryption_key',
  'private_key',
  'client_secret',
  'database_url',
] as const;

/**
 * Sanitizes an object by redacting sensitive fields
 */
export function sanitizeForLogging(obj: any, depth = 0): any {
  if (depth > 10) {
    return '[Max depth reached]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Check if it looks like a JWT token
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(obj)) {
      return '[REDACTED: JWT Token]';
    }
    // Check if it looks like a long hex string (encryption key, etc.)
    if (/^[0-9a-fA-F]{32,}$/.test(obj)) {
      return '[REDACTED: Secret Key]';
    }
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this key should be redacted
    const shouldRedact = SENSITIVE_KEYS.some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey),
    );

    if (shouldRedact) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string that might contain sensitive information
 */
export function sanitizeString(str: string): string {
  if (!str) return str;

  // Redact JWT tokens
  str = str.replace(
    /Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g,
    'Bearer [REDACTED]',
  );

  // Redact long hex strings (likely secrets)
  str = str.replace(/[0-9a-fA-F]{32,}/g, '[REDACTED: Secret]');

  // Redact common patterns
  SENSITIVE_KEYS.forEach((key) => {
    const regex = new RegExp(`(${key}\\s*[:=]\\s*)([^\\s,}]+)`, 'gi');
    str = str.replace(regex, `$1[REDACTED]`);
  });

  return str;
}

