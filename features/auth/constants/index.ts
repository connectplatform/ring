import { UserRole } from '../types';
import i18next from 'i18next';

export const AUTH_ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
};

export const ERROR_MESSAGES = {
  INVALID_EMAIL: i18next.t('invalidEmail'),
  INVALID_PASSWORD: i18next.t('errors.invalidPassword'),
  EMAIL_ALREADY_IN_USE: i18next.t('errors.emailAlreadyInUse'),
  USER_NOT_FOUND: i18next.t('errors.userNotFound'),
  WRONG_PASSWORD: i18next.t('errors.wrongPassword'),
  WEAK_PASSWORD: i18next.t('errors.weakPassword'),
  NETWORK_ERROR: i18next.t('errors.networkError'),
  UNKNOWN_ERROR: i18next.t('errors.unknownError'),
};

export const SUCCESS_MESSAGES = {
  SIGNUP_SUCCESS: i18next.t('accountCreated'),
  LOGIN_SUCCESS: i18next.t('success'),
  LOGOUT_SUCCESS: i18next.t('success'),
  PASSWORD_RESET_EMAIL_SENT: i18next.t('passwordResetEmailSent'),
  PASSWORD_RESET_SUCCESS: i18next.t('passwordResetSuccess'),
  EMAIL_VERIFICATION_SENT: i18next.t('emailVerificationSent'),
  EMAIL_VERIFIED: i18next.t('emailVerified'),
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
  EMAIL: i18next.t('emailAddress'),
  PASSWORD: i18next.t('password'),
  CONFIRM_PASSWORD: i18next.t('confirmPassword'),
  NAME: i18next.t('name'),
  SIGN_IN: i18next.t('signIn'),
  SIGN_UP: i18next.t('signUp'),
  FORGOT_PASSWORD: i18next.t('forgotPassword'),
  RESET_PASSWORD: i18next.t('resetPassword'),
};

export const AUTH_BUTTON_LABELS = {
  SIGN_IN: i18next.t('signIn'),
  SIGN_UP: i18next.t('signUp'),
  SIGN_OUT: i18next.t('signOut'),
  SIGN_IN_WITH_GOOGLE: i18next.t('signInWithGoogle'),
  FORGOT_PASSWORD: i18next.t('forgotPassword'),
  RESET_PASSWORD: i18next.t('resetPassword'),
  SEND_RESET_EMAIL: i18next.t('sendResetEmail'),
};

export const AUTH_FORM_PLACEHOLDERS = {
  EMAIL: i18next.t('emailPlaceholder'),
  PASSWORD: i18next.t('passwordPlaceholder'),
  CONFIRM_PASSWORD: i18next.t('confirmPasswordPlaceholder'),
  NAME: i18next.t('namePlaceholder'),
};

export const AUTH_VALIDATION_MESSAGES = {
  REQUIRED_FIELD: i18next.t('fieldRequired'),
  INVALID_EMAIL: i18next.t('invalidEmail'),
  PASSWORD_MISMATCH: i18next.t('passwordsDoNotMatch'),
  PASSWORD_TOO_SHORT: i18next.t('errors.weakPassword'),
};