/**
 * Central error definitions with Error.cause support (ES2022)
 * 
 * This file contains all custom error classes used throughout the Ring platform.
 * All error classes support the ES2022 Error.cause feature for better error traceability.
 */

/**
 * Base error class with enhanced Error.cause support
 */
export class RingError extends Error {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, { cause });
    this.name = 'RingError';
    this.context = context;
  }
  
  context?: any;
}

/**
 * Firebase-related error classes
 */
export class FirebaseConfigError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'FirebaseConfigError';
  }
}

export class FirebaseInitializationError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'FirebaseInitializationError';
  }
}

/**
 * Profile-related error classes
 */
export class ProfileAuthError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'ProfileAuthError';
  }
}

export class ProfileValidationError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'ProfileValidationError';
  }
}

export class ProfileUpdateError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'ProfileUpdateError';
  }
}

/**
 * Entity-related error classes
 */
export class EntityAuthError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'EntityAuthError';
  }
}

export class EntityPermissionError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'EntityPermissionError';
  }
}

export class EntityQueryError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'EntityQueryError';
  }
}

export class EntityDatabaseError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'EntityDatabaseError';
  }
}

/**
 * Opportunity-related error classes
 */
export class OpportunityAuthError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'OpportunityAuthError';
  }
}

export class OpportunityPermissionError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'OpportunityPermissionError';
  }
}

export class OpportunityQueryError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'OpportunityQueryError';
  }
}

export class OpportunityDatabaseError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'OpportunityDatabaseError';
  }
}

/**
 * Utility-related error classes
 */
export class UtilityError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'UtilityError';
  }
}

export class FetchError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'FetchError';
  }
}

export class ValidationError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication-related error classes
 */
export class AuthError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'AuthError';
  }
}

export class AuthPermissionError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'AuthPermissionError';
  }
}

export class AuthSessionError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'AuthSessionError';
  }
}

/**
 * API-related error classes
 */
export class APIError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'APIError';
  }
}

export class APIRateLimitError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'APIRateLimitError';
  }
}

export class APIValidationError extends RingError {
  constructor(message: string, cause?: Error, context?: any) {
    super(message, cause, context);
    this.name = 'APIValidationError';
  }
}

/**
 * Utility function to check if an error is a Ring platform error
 */
export function isRingError(error: unknown): error is RingError {
  return error instanceof RingError;
}

/**
 * Utility function to extract error context from Ring errors
 */
export function getErrorContext(error: unknown): any {
  if (isRingError(error)) {
    return error.context;
  }
  return null;
}

/**
 * Utility function to extract error cause from Ring errors
 */
export function getErrorCause(error: unknown): Error | undefined {
  if (isRingError(error)) {
    return error.cause as Error | undefined;
  }
  return undefined;
}

/**
 * Utility function to log Ring errors with full context
 */
export function logRingError(error: unknown, prefix: string = 'Ring Error'): void {
  console.error(`${prefix}:`, error);
  
  if (isRingError(error)) {
    if (error.context) {
      console.error('Error context:', error.context);
    }
    if (error.cause) {
      console.error('Error cause:', error.cause);
    }
  }
} 