// Import administrative and confidential roles from user-role module.
// TODO: Consider using dynamic imports if bundle splitting becomes a goal.
import {
  ADMIN_GUI_ASSIGNABLE_ROLES,
  CONFIDENTIAL_ACCESS_ROLES,
} from '../user-role';

// NOTE: All constants are intended for client-side use.
//       Localize UI strings on render through next-intl to support i18n.


// Define standard authentication-related route paths.
export const AUTH_ROUTES = {
  LOGIN: '/login',                         // Route for login page
  SIGNUP: '/signup',                       // Route for sign-up/registration
  FORGOT_PASSWORD: '/forgot-password',     // Route for initiating password reset
  RESET_PASSWORD: '/reset-password',       // Route for completing password reset
  VERIFY_EMAIL: '/verify-email',           // Route for email verification page
  // TODO: Evaluate using App Router conventions (Next.js 13+) if migrating to /app.
};


// Centralized human-readable error messages for authentication flows.
// TODO: Use next-intl to load error messages at runtime for full i18n/localization coverage.
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email',                    // Shown for invalid email format/entry
  INVALID_PASSWORD: 'Invalid password',              // Shown for wrong password format/entry
  EMAIL_ALREADY_IN_USE: 'Email already in use',      // Shown if registering with taken email
  USER_NOT_FOUND: 'User not found',                  // Shown if user record doesn't exist
  WRONG_PASSWORD: 'Wrong password',                  // Shown for authentication failure
  WEAK_PASSWORD: 'Weak password',                    // Shown for insufficient password complexity
  NETWORK_ERROR: 'Network error',                    // Shown for connectivity issues
  UNKNOWN_ERROR: 'Unknown error',                    // Fallback for miscellaneous or unclassified errors
};


// Standard success messages for auth actions.
// TODO: Use native useFormStatus() hook (React 19/Next 16) for real-time state feedback, when building forms.
export const SUCCESS_MESSAGES = {
  SIGNUP_SUCCESS: 'Account created',                     // Shown after successful account creation
  LOGIN_SUCCESS: 'Success',                              // Shown upon successful login
  LOGOUT_SUCCESS: 'Success',                             // Shown upon successful logout
  PASSWORD_RESET_EMAIL_SENT: 'Password reset email sent',// Shown after reset email submission
  PASSWORD_RESET_SUCCESS: 'Password reset successful',   // Shown after successful password change
  EMAIL_VERIFICATION_SENT: 'Email verification sent',    // Shown after email verification requested
  EMAIL_VERIFIED: 'Email verified',                      // Shown when email verified
};


// Key for storing authentication state (e.g. localStorage/sessionStorage).
export const AUTH_PERSISTENCE_KEY = 'auth_state';

// Default shape of authentication state for context/providers.
// TODO: Consider migrating to React 19 Context with useOptimistic/useFormStatus if refactoring state management.
export const DEFAULT_AUTH_STATE = {
  user: null,       // null until authenticated or failed
  isLoading: true,  // true until auth check completes
  error: null,      // null unless error present
};


// ===== DEPRECATED CONSTANTS =====

// LEGACY: Prefer using ADMIN_GUI_ASSIGNABLE_ROLES directly.
// @deprecated
/** @deprecated Use ADMIN_GUI_ASSIGNABLE_ROLES from @/features/auth/user-role */
// TODO: Remove usage throughout codebase and delete this export when safe.
export const USER_ROLES = ADMIN_GUI_ASSIGNABLE_ROLES;

// LEGACY: Prefer using CONFIDENTIAL_ACCESS_ROLES directly.
// @deprecated
/** @deprecated Use CONFIDENTIAL_ACCESS_ROLES from @/features/auth/user-role */
// TODO: Remove usage throughout codebase and delete this export when safe.
export const CONFIDENTIAL_ROLES = CONFIDENTIAL_ACCESS_ROLES;


// Form input labels for authentication screens.
// TODO: Refactor to use next-intl messages for dynamic language selection.
export const AUTH_FORM_LABELS = {
  EMAIL: 'Email address',            // Label for email input field
  PASSWORD: 'Password',              // Label for password input field
  CONFIRM_PASSWORD: 'Confirm password', // Label for password confirmation
  NAME: 'Name',                      // Label for user name
  SIGN_IN: 'Sign in',                // Button label for sign-in
  SIGN_UP: 'Sign up',                // Button label for registration
  FORGOT_PASSWORD: 'Forgot password',// Link/button for password recovery
  RESET_PASSWORD: 'Reset password',  // Button for submitting password reset
};


// Button labels specifically for authentication-related actions.
// TODO: Consider implementing React 19/Next 16's native <Button /> semantic features for accessibility.
export const AUTH_BUTTON_LABELS = {
  SIGN_IN: 'Sign in',                    // For main sign-in action
  SIGN_UP: 'Sign up',                    // For main sign-up action
  SIGN_OUT: 'Sign out',                  // For log-out action
  SIGN_IN_WITH_GOOGLE: 'Sign in with Google', // 3rd-party auth
  FORGOT_PASSWORD: 'Forgot password',    // For recovery action
  RESET_PASSWORD: 'Reset password',      // For password resetting
  SEND_RESET_EMAIL: 'Send reset email',  // For triggering password reset email
};


// Placeholder values for input fields on auth forms.
export const AUTH_FORM_PLACEHOLDERS = {
  EMAIL: 'Enter your email',                 // Email input placeholder
  PASSWORD: 'Enter your password',           // Password input placeholder
  CONFIRM_PASSWORD: 'Confirm your password', // Confirm password input placeholder
  NAME: 'Enter your name',                   // Name input placeholder
};


// Validation error messages for input fields in authentication forms.
// TODO: Integrate with new React 19 `useFormStatus()` and native HTML5 validation for improved user feedback.
export const AUTH_VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',      // Displayed if field is left blank
  INVALID_EMAIL: 'Invalid email',                // Displayed for email with wrong format
  PASSWORD_MISMATCH: 'Passwords do not match',   // Displayed if confirm password fails
  PASSWORD_TOO_SHORT: 'Weak password',           // Displayed if password doesn't meet length/security rules
};