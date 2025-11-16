/**
 * Input Validation Utilities
 * 
 * Validates and sanitizes user input before processing or storage
 */

import { sanitizeText, sanitizeUrl } from './sanitize';

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates and sanitizes email input
 */
export function validateAndSanitizeEmail(email: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const sanitized = sanitizeText(email).toLowerCase().trim();

  if (!sanitized) {
    return { valid: false, sanitized: '', error: 'Email is required' };
  }

  if (!isValidEmail(sanitized)) {
    return { valid: false, sanitized, error: 'Invalid email format' };
  }

  // Additional length check
  if (sanitized.length > 254) {
    return { valid: false, sanitized, error: 'Email is too long' };
  }

  return { valid: true, sanitized };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password is too long (maximum 128 characters)');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Optional: special character requirement
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push('Password must contain at least one special character');
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates and sanitizes text input
 */
export function validateTextInput(
  input: string,
  options: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    pattern?: RegExp;
  } = {},
): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const { minLength, maxLength, required = false, pattern } = options;
  const sanitized = sanitizeText(input);

  if (required && !sanitized) {
    return { valid: false, sanitized: '', error: 'This field is required' };
  }

  if (minLength !== undefined && sanitized.length < minLength) {
    return {
      valid: false,
      sanitized,
      error: `Must be at least ${minLength} characters`,
    };
  }

  if (maxLength !== undefined && sanitized.length > maxLength) {
    return {
      valid: false,
      sanitized,
      error: `Must be no more than ${maxLength} characters`,
    };
  }

  if (pattern && !pattern.test(sanitized)) {
    return { valid: false, sanitized, error: 'Invalid format' };
  }

  return { valid: true, sanitized };
}

/**
 * Validates and sanitizes URL input
 */
export function validateUrl(url: string): {
  valid: boolean;
  sanitized: string | null;
  error?: string;
} {
  const sanitized = sanitizeUrl(url);

  if (!sanitized) {
    return {
      valid: false,
      sanitized: null,
      error: 'Invalid URL format',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Validates phone number format (basic)
 */
export function validatePhoneNumber(phone: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  const sanitized = sanitizeText(phone).replace(/\s+/g, '');

  // Basic phone validation (allows international format)
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

  if (!phoneRegex.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: 'Invalid phone number format',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Sanitizes form data object
 */
export function sanitizeFormData<T extends Record<string, any>>(
  data: T,
): T {
  const sanitized = { ...data } as T;

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      (sanitized as any)[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      (sanitized as any)[key] = value.map((item: any) =>
        typeof item === 'string' ? sanitizeText(item) : item,
      );
    } else if (value && typeof value === 'object') {
      (sanitized as any)[key] = sanitizeFormData(value);
    }
  }

  return sanitized;
}

