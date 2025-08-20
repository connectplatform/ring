import { UserRole } from '../types';
// NOTE: These constants are used on the client; use plain strings as defaults.
// Components should localize their UI with next-intl at render time.

export const AUTH_ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
};

export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email',
  INVALID_PASSWORD: 'Invalid password',
  EMAIL_ALREADY_IN_USE: 'Email already in use',
  USER_NOT_FOUND: 'User not found',
  WRONG_PASSWORD: 'Wrong password',
  WEAK_PASSWORD: 'Weak password',
  NETWORK_ERROR: 'Network error',
  UNKNOWN_ERROR: 'Unknown error',
};

export const SUCCESS_MESSAGES = {
  SIGNUP_SUCCESS: 'Account created',
  LOGIN_SUCCESS: 'Success',
  LOGOUT_SUCCESS: 'Success',
  PASSWORD_RESET_EMAIL_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',
  EMAIL_VERIFICATION_SENT: 'Email verification sent',
  EMAIL_VERIFIED: 'Email verified',
};

export const AUTH_PERSISTENCE_KEY = 'auth_state';

export const DEFAULT_AUTH_STATE = {
  user: null,
  isLoading: true,
  error: null,
};

export const USER_ROLES: UserRole[] = [UserRole.SUBSCRIBER, UserRole.MEMBER, UserRole.CONFIDENTIAL, UserRole.ADMIN];

export const CONFIDENTIAL_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CONFIDENTIAL];

export const AUTH_FORM_LABELS = {
  EMAIL: 'Email address',
  PASSWORD: 'Password',
  CONFIRM_PASSWORD: 'Confirm password',
  NAME: 'Name',
  SIGN_IN: 'Sign in',
  SIGN_UP: 'Sign up',
  FORGOT_PASSWORD: 'Forgot password',
  RESET_PASSWORD: 'Reset password',
};

export const AUTH_BUTTON_LABELS = {
  SIGN_IN: 'Sign in',
  SIGN_UP: 'Sign up',
  SIGN_OUT: 'Sign out',
  SIGN_IN_WITH_GOOGLE: 'Sign in with Google',
  FORGOT_PASSWORD: 'Forgot password',
  RESET_PASSWORD: 'Reset password',
  SEND_RESET_EMAIL: 'Send reset email',
};

export const AUTH_FORM_PLACEHOLDERS = {
  EMAIL: 'Enter your email',
  PASSWORD: 'Enter your password',
  CONFIRM_PASSWORD: 'Confirm your password',
  NAME: 'Enter your name',
};

export const AUTH_VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email',
  PASSWORD_MISMATCH: 'Passwords do not match',
  PASSWORD_TOO_SHORT: 'Weak password',
};