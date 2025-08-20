// Auth Components Index
// Centralized exports for all authentication-related components

export { AnimatedLoginContainer } from './animated-login-content'
export { default as AuthErrorContent } from './auth-error-content'
export { default as EmailSignupForm } from './email-signup-form'
export { default as GoogleSignInButton } from './google-sign-in-button'
export { default as LoginForm } from './login-form'
export { default as NewUserForm } from './new-user-form'
export { default as ProfileContent } from './profile-content'
export { SessionProvider } from './session-provider'
export { default as Settings } from './settings-content'
export { default as SignupForm } from './email-signup-form'
export { default as SettingsContent } from './settings-content'
export { default as UnifiedLoginComponent } from './unified-login-component'
export { WalletConnectPopup } from './wallet-connect-popup'
export { default as CryptoOnboardingForm } from './crypto-onboarding-form'
export { default as UserProfileForm } from './user-profile-form'    
export { default as UserSettingsForm } from './user-settings-form'
export { default as UserSettingsOptimistic } from './user-settings-optimistic'
export { default as UpgradeRequestModal } from './upgrade-request-modal'
export { default as MembershipContent } from './membership-content'
export { AdminUserManager } from './admin-user-manager'


// TODO: Additional component exports - Uncomment when these files are created
// export { default as AuthLayout } from './auth-layout' // Layout wrapper for auth pages with consistent styling
// export { default as AuthProvider } from './auth-provider' // Context provider for auth state management
// export { default as AuthGuard } from './auth-guard' // Route protection component for authenticated routes
// export { default as LoginButton } from './login-button' // Reusable login button component
// export { default as LogoutButton } from './logout-button' // Reusable logout button component
// export { default as PasswordResetForm } from './password-reset-form' // Form for password reset functionality
// export { default as RegistrationForm } from './registration-form' // Alternative registration form component
// export { default as SocialLoginButtons } from './social-login-buttons' // Container for multiple social login options
// export { default as TwoFactorAuth } from './two-factor-auth' // 2FA setup and verification component
// export { default as UserMenu } from './user-menu' // Dropdown menu for user account actions
// export { default as VerificationForm } from './verification-form' // Email/phone verification form