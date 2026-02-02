// Enhanced Validation Utilities for TutorCat
// Based on the example's comprehensive validation approach

import { sanitizeEmail, sanitizeName, sanitizeInput } from './sanitizers';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitizedData?: any;
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]+$/,
  NAME: /^[a-zA-Z\s\-']+$/,
  URL: /^https?:\/\/.+/,
};

// Common validation messages - using translation keys
export const VALIDATION_MESSAGES = {
  REQUIRED: 'validation.required',
  EMAIL_INVALID: 'validation.emailInvalid',
  PASSWORD_TOO_SHORT: 'validation.passwordTooShort',
  PASSWORD_WEAK: 'validation.passwordWeak',
  PASSWORD_MISMATCH: 'validation.passwordsDoNotMatch',
  NAME_INVALID: 'validation.nameInvalid',
  USERNAME_INVALID: 'validation.usernameInvalid',
  URL_INVALID: 'validation.urlInvalid',
  LENGTH_MIN: (min: number) => `Must be at least ${min} characters`,
  LENGTH_MAX: (max: number) => `Must be no more than ${max} characters`,
};

// Email validation with sanitization
export function validateEmail(email: string): ValidationResult {
  const sanitized = sanitizeEmail(email);

  if (!sanitized) {
    return {
      isValid: false,
      errors: { email: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  if (!VALIDATION_PATTERNS.EMAIL.test(sanitized)) {
    return {
      isValid: false,
      errors: { email: VALIDATION_MESSAGES.EMAIL_INVALID }
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitizedData: sanitized
  };
}

// Password validation
export function validatePassword(password: string, options: {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
} = {}): ValidationResult {
  const {
    minLength = 8,
    requireUppercase = false, // Not required by default
    requireLowercase = true,  // At least 1 letter
    requireNumbers = true,    // At least 1 number
    requireSpecialChars = false // Not required by default
  } = options;

  if (!password || password.trim() === '') {
    return {
      isValid: false,
      errors: { password: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  const errors: Record<string, string> = {};

  if (password.length < minLength) {
    errors.password = `Password must be at least ${minLength} characters long`;
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.password = VALIDATION_MESSAGES.PASSWORD_WEAK;
  }

  if (requireLowercase && !/[a-zA-Z]/.test(password)) {
    errors.password = 'Password must contain at least one letter';
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.password = 'Password must contain at least one number';
  }

  if (requireSpecialChars && !/[@$!%*?&]/.test(password)) {
    errors.password = VALIDATION_MESSAGES.PASSWORD_WEAK;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Password strength checker for real-time hints
export function getPasswordStrength(password: string): {
  isValid: boolean;
  requirements: {
    length: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
  };
  score: number; // 0-3
} {
  const requirements = {
    length: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password)
  };

  const score = Object.values(requirements).filter(Boolean).length;

  return {
    isValid: score === 3,
    requirements,
    score
  };
}

// Name validation with sanitization
export function validateName(name: string, fieldName: string = 'name'): ValidationResult {
  const sanitized = sanitizeName(name);

  if (!sanitized) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  if (sanitized.length < 2) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.LENGTH_MIN(2) }
    };
  }

  if (!VALIDATION_PATTERNS.NAME.test(sanitized)) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.NAME_INVALID }
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitizedData: sanitized
  };
}

// Student ID validation


// Username validation
export function validateUsername(username: string): ValidationResult {
  const sanitized = sanitizeInput(username, 50);

  if (!sanitized) {
    return {
      isValid: false,
      errors: { username: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  if (sanitized.length < 3) {
    return {
      isValid: false,
      errors: { username: VALIDATION_MESSAGES.LENGTH_MIN(3) }
    };
  }

  if (!VALIDATION_PATTERNS.USERNAME.test(sanitized)) {
    return {
      isValid: false,
      errors: { username: VALIDATION_MESSAGES.USERNAME_INVALID }
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitizedData: sanitized
  };
}

// URL validation
export function validateUrl(url: string): ValidationResult {
  if (!url || url.trim() === '') {
    return {
      isValid: true, // URL is optional
      errors: {}
    };
  }

  if (!VALIDATION_PATTERNS.URL.test(url)) {
    return {
      isValid: false,
      errors: { url: VALIDATION_MESSAGES.URL_INVALID }
    };
  }

  return {
    isValid: true,
    errors: {},
    sanitizedData: url
  };
}

// Length validation
export function validateLength(value: string, minLength: number, maxLength: number, fieldName: string = 'field'): ValidationResult {
  if (!value) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  if (value.length < minLength) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.LENGTH_MIN(minLength) }
    };
  }

  if (value.length > maxLength) {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.LENGTH_MAX(maxLength) }
    };
  }

  return {
    isValid: true,
    errors: {}
  };
}

// Required field validation
export function validateRequired(value: any, fieldName: string = 'field'): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      isValid: false,
      errors: { [fieldName]: VALIDATION_MESSAGES.REQUIRED }
    };
  }

  return {
    isValid: true,
    errors: {}
  };
}

// Password confirmation validation
export function validatePasswordConfirmation(password: string, confirmPassword: string): ValidationResult {
  if (password !== confirmPassword) {
    return {
      isValid: false,
      errors: { confirmPassword: VALIDATION_MESSAGES.PASSWORD_MISMATCH }
    };
  }

  return {
    isValid: true,
    errors: {}
  };
}

// User registration validation
export function validateUserRegistration(data: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const sanitizedData: any = {};

  // Validate first name
  const firstNameValidation = validateName(data.firstName, 'firstName');
  if (!firstNameValidation.isValid) {
    Object.assign(errors, firstNameValidation.errors);
  } else {
    sanitizedData.firstName = firstNameValidation.sanitizedData;
  }

  // Validate last name
  const lastNameValidation = validateName(data.lastName, 'lastName');
  if (!lastNameValidation.isValid) {
    Object.assign(errors, lastNameValidation.errors);
  } else {
    sanitizedData.lastName = lastNameValidation.sanitizedData;
  }

  // Validate username
  if (!data.username || data.username.trim() === '') {
    errors.username = 'Username is required';
  } else {
    const usernameValidation = validateUsername(data.username);
    if (!usernameValidation.isValid) {
      Object.assign(errors, usernameValidation.errors);
    } else {
      sanitizedData.username = usernameValidation.sanitizedData;
    }
  }

  // Validate email
  const emailValidation = validateEmail(data.email);
  if (!emailValidation.isValid) {
    Object.assign(errors, emailValidation.errors);
  } else {
    sanitizedData.email = emailValidation.sanitizedData;
  }

  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    Object.assign(errors, passwordValidation.errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}

// Form validation helper
export function validateForm(data: Record<string, any>, rules: Record<string, any>): ValidationResult {
  const errors: Record<string, string> = {};
  const sanitizedData: Record<string, any> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const fieldError = validateInput(value, rule, field);

    if (fieldError) {
      errors[field] = fieldError;
    } else if (rule.sanitize) {
      sanitizedData[field] = rule.sanitize(value);
    } else {
      sanitizedData[field] = value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}

// Enhanced validateInput from legacy code
export function validateInput(value: any, rule: any, fieldName: string = 'field'): string | null {
  // Required validation
  if (rule.required && (!value || value.toString().trim() === '')) {
    return `${fieldName} is required`;
  }

  // Skip other validations if value is empty and not required
  if (!value || value.toString().trim() === '') {
    return null;
  }

  // Type validation
  if (rule.type) {
    switch (rule.type) {
      case 'email':
        if (!VALIDATION_PATTERNS.EMAIL.test(value)) {
          return VALIDATION_MESSAGES.EMAIL_INVALID;
        }
        break;
      case 'url':
        if (!VALIDATION_PATTERNS.URL.test(value)) {
          return VALIDATION_MESSAGES.URL_INVALID;
        }
        break;
    }
  }

  // Length validation
  if (rule.minLength && value.length < rule.minLength) {
    return VALIDATION_MESSAGES.LENGTH_MIN(rule.minLength);
  }

  if (rule.maxLength && value.length > rule.maxLength) {
    return VALIDATION_MESSAGES.LENGTH_MAX(rule.maxLength);
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(value)) {
    return rule.patternMessage || `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rule.custom && !rule.custom(value)) {
    return rule.customMessage || `${fieldName} is invalid`;
  }

  return null;
}
