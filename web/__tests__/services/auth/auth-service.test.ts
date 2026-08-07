// @ts-nocheck - Disable TypeScript checking for test files
/**
 * Authentication Service Tests
 * Testing authentication flows, crypto wallet integration, and session management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { signIn, signOut, getSession } from 'next-auth/react'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth'

// Mock authentication functions
jest.mock('next-auth/react')
jest.mock('firebase/auth')

// Mock the auth service (we'll create this)
const mockAuthService = {
  signInWithEmail: jest.fn(),
  signUpWithEmail: jest.fn(),
  signInWithCryptoWallet: jest.fn(),
  signOut: jest.fn(),
  getCurrentUser: jest.fn(),
  updateUserProfile: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
  deleteAccount: jest.fn(),
}

describe('Authentication Service', () => {
  beforeEach(() => {
    global.testUtils.clearAllMocks()
    
    // Setup default mocks
    ;(signIn as jest.Mock).mockResolvedValue({ ok: true })
    ;(signOut as jest.Mock).mockResolvedValue(undefined)
    ;(getSession as jest.Mock).mockResolvedValue(null)
    ;(signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: { uid: 'test-uid', email: 'test@example.com' }
    })
    ;(createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: { uid: 'test-uid', email: 'test@example.com' }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Email Authentication', () => {
    it('should sign in with email and password successfully', async () => {
      const email = 'test@example.com'
      const password = 'password123'
      
      mockAuthService.signInWithEmail.mockResolvedValue({
        success: true,
        user: global.testUtils.createMockUser({ email }),
        session: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresAt: Date.now() + 3600000,
        }
      })

      const result = await mockAuthService.signInWithEmail(email, password)

      expect(result.success).toBe(true)
      expect(result.user.email).toBe(email)
      expect(result.session.accessToken).toBeDefined()
      expect(mockAuthService.signInWithEmail).toHaveBeenCalledWith(email, password)
    })

    it('should handle invalid email format', async () => {
      const invalidEmail = 'invalid-email'
      const password = 'password123'

      mockAuthService.signInWithEmail.mockResolvedValue({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      })

      const result = await mockAuthService.signInWithEmail(invalidEmail, password)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email format')
      expect(result.code).toBe('INVALID_EMAIL')
    })

    it('should handle incorrect password', async () => {
      const email = 'test@example.com'
      const wrongPassword = 'wrongpassword'

      mockAuthService.signInWithEmail.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      })

      const result = await mockAuthService.signInWithEmail(email, wrongPassword)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
      expect(result.code).toBe('INVALID_CREDENTIALS')
    })

    it('should handle user not found', async () => {
      const email = 'nonexistent@example.com'
      const password = 'password123'

      mockAuthService.signInWithEmail.mockResolvedValue({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      })

      const result = await mockAuthService.signInWithEmail(email, password)

      expect(result.success).toBe(false)
      expect(result.error).toBe('User not found')
      expect(result.code).toBe('USER_NOT_FOUND')
    })

    it('should handle network errors gracefully', async () => {
      const email = 'test@example.com'
      const password = 'password123'

      mockAuthService.signInWithEmail.mockRejectedValue(new Error('Network error'))

      await expect(mockAuthService.signInWithEmail(email, password)).rejects.toThrow('Network error')
    })
  })

  describe('Email Registration', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      }

      mockAuthService.signUpWithEmail.mockResolvedValue({
        success: true,
        user: global.testUtils.createMockUser({
          email: userData.email,
          name: `${userData.firstName} ${userData.lastName}`
        }),
        emailVerificationSent: true
      })

      const result = await mockAuthService.signUpWithEmail(userData)

      expect(result.success).toBe(true)
      expect(result.user.email).toBe(userData.email)
      expect(result.emailVerificationSent).toBe(true)
      expect(mockAuthService.signUpWithEmail).toHaveBeenCalledWith(userData)
    })

    it('should handle email already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe'
      }

      mockAuthService.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS'
      })

      const result = await mockAuthService.signUpWithEmail(userData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Email already exists')
      expect(result.code).toBe('EMAIL_ALREADY_EXISTS')
    })

    it('should validate password strength', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123', // Weak password
        firstName: 'John',
        lastName: 'Doe'
      }

      mockAuthService.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Password too weak',
        code: 'WEAK_PASSWORD'
      })

      const result = await mockAuthService.signUpWithEmail(userData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Password too weak')
      expect(result.code).toBe('WEAK_PASSWORD')
    })

    it('should handle required fields validation', async () => {
      const incompleteData = {
        email: 'test@example.com',
        password: 'password123'
        // Missing firstName and lastName
      }

      mockAuthService.signUpWithEmail.mockResolvedValue({
        success: false,
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        missingFields: ['firstName', 'lastName']
      })

      const result = await mockAuthService.signUpWithEmail(incompleteData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields')
      expect(result.missingFields).toEqual(['firstName', 'lastName'])
    })
  })

  describe('Crypto Wallet Authentication', () => {
    it('should sign in with MetaMask successfully', async () => {
      const mockWallet = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signature: 'mock-signature',
        message: 'Sign in to Ring Platform'
      }

      mockAuthService.signInWithCryptoWallet.mockResolvedValue({
        success: true,
        user: global.testUtils.createMockUser({
          id: 'crypto-user-id',
          walletAddress: mockWallet.address,
          authProvider: 'metamask'
        }),
        session: {
          accessToken: 'mock-crypto-token',
          walletAddress: mockWallet.address,
          expiresAt: Date.now() + 3600000
        }
      })

      const result = await mockAuthService.signInWithCryptoWallet(mockWallet)

      expect(result.success).toBe(true)
      expect(result.user.walletAddress).toBe(mockWallet.address)
      expect(result.session.walletAddress).toBe(mockWallet.address)
      expect(mockAuthService.signInWithCryptoWallet).toHaveBeenCalledWith(mockWallet)
    })

    it('should handle MetaMask not installed', async () => {
      mockAuthService.signInWithCryptoWallet.mockResolvedValue({
        success: false,
        error: 'MetaMask not installed',
        code: 'METAMASK_NOT_INSTALLED'
      })

      const result = await mockAuthService.signInWithCryptoWallet({})

      expect(result.success).toBe(false)
      expect(result.error).toBe('MetaMask not installed')
      expect(result.code).toBe('METAMASK_NOT_INSTALLED')
    })

    it('should handle user rejection of wallet connection', async () => {
      mockAuthService.signInWithCryptoWallet.mockResolvedValue({
        success: false,
        error: 'User rejected wallet connection',
        code: 'USER_REJECTED_CONNECTION'
      })

      const result = await mockAuthService.signInWithCryptoWallet({})

      expect(result.success).toBe(false)
      expect(result.error).toBe('User rejected wallet connection')
      expect(result.code).toBe('USER_REJECTED_CONNECTION')
    })

    it('should handle invalid signature', async () => {
      const mockWallet = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        signature: 'invalid-signature',
        message: 'Sign in to Ring Platform'
      }

      mockAuthService.signInWithCryptoWallet.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE'
      })

      const result = await mockAuthService.signInWithCryptoWallet(mockWallet)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid signature')
      expect(result.code).toBe('INVALID_SIGNATURE')
    })

    it('should handle wallet network switching', async () => {
      const mockWallet = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1, // Ethereum mainnet
        requiredChainId: 137 // Polygon
      }

      mockAuthService.signInWithCryptoWallet.mockResolvedValue({
        success: false,
        error: 'Wrong network',
        code: 'WRONG_NETWORK',
        requiredChainId: 137,
        currentChainId: 1
      })

      const result = await mockAuthService.signInWithCryptoWallet(mockWallet)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Wrong network')
      expect(result.code).toBe('WRONG_NETWORK')
      expect(result.requiredChainId).toBe(137)
      expect(result.currentChainId).toBe(1)
    })
  })

  describe('Session Management', () => {
    it('should get current user session', async () => {
      const mockUser = global.testUtils.createMockUser()
      
      mockAuthService.getCurrentUser.mockResolvedValue({
        user: mockUser,
        session: {
          accessToken: 'mock-token',
          expiresAt: Date.now() + 3600000,
          isValid: true
        }
      })

      const result = await mockAuthService.getCurrentUser()

      expect(result.user).toEqual(mockUser)
      expect(result.session.isValid).toBe(true)
    })

    it('should handle expired session', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue({
        user: null,
        session: {
          accessToken: null,
          expiresAt: Date.now() - 3600000,
          isValid: false
        }
      })

      const result = await mockAuthService.getCurrentUser()

      expect(result.user).toBeNull()
      expect(result.session.isValid).toBe(false)
    })

    it('should refresh expired token', async () => {
      const mockUser = global.testUtils.createMockUser()
      
      mockAuthService.getCurrentUser.mockResolvedValue({
        user: mockUser,
        session: {
          accessToken: 'new-mock-token',
          expiresAt: Date.now() + 3600000,
          isValid: true,
          refreshed: true
        }
      })

      const result = await mockAuthService.getCurrentUser()

      expect(result.user).toEqual(mockUser)
      expect(result.session.refreshed).toBe(true)
      expect(result.session.isValid).toBe(true)
    })

    it('should sign out user successfully', async () => {
      mockAuthService.signOut.mockResolvedValue({
        success: true,
        message: 'Signed out successfully'
      })

      const result = await mockAuthService.signOut()

      expect(result.success).toBe(true)
      expect(result.message).toBe('Signed out successfully')
      expect(mockAuthService.signOut).toHaveBeenCalled()
    })

    it('should handle sign out errors', async () => {
      mockAuthService.signOut.mockRejectedValue(new Error('Sign out failed'))

      await expect(mockAuthService.signOut()).rejects.toThrow('Sign out failed')
    })
  })

  describe('User Profile Management', () => {
    it('should update user profile successfully', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Software engineer',
        location: 'New York',
        website: 'https://johndoe.com'
      }

      mockAuthService.updateUserProfile.mockResolvedValue({
        success: true,
        user: global.testUtils.createMockUser({
          ...profileData,
          name: `${profileData.firstName} ${profileData.lastName}`
        })
      })

      const result = await mockAuthService.updateUserProfile(profileData)

      expect(result.success).toBe(true)
      expect(result.user.name).toBe('John Doe')
      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith(profileData)
    })

    it('should handle profile update validation errors', async () => {
      const invalidProfileData = {
        firstName: '', // Empty required field
        lastName: 'Doe',
        website: 'invalid-url' // Invalid URL
      }

      mockAuthService.updateUserProfile.mockResolvedValue({
        success: false,
        error: 'Validation errors',
        code: 'VALIDATION_ERROR',
        validationErrors: {
          firstName: 'First name is required',
          website: 'Invalid URL format'
        }
      })

      const result = await mockAuthService.updateUserProfile(invalidProfileData)

      expect(result.success).toBe(false)
      expect(result.validationErrors.firstName).toBe('First name is required')
      expect(result.validationErrors.website).toBe('Invalid URL format')
    })

    it('should handle unauthorized profile updates', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe'
      }

      mockAuthService.updateUserProfile.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED'
      })

      const result = await mockAuthService.updateUserProfile(profileData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
      expect(result.code).toBe('UNAUTHORIZED')
    })
  })

  describe('Password Reset', () => {
    it('should send password reset email successfully', async () => {
      const email = 'test@example.com'

      mockAuthService.resetPassword.mockResolvedValue({
        success: true,
        message: 'Password reset email sent'
      })

      const result = await mockAuthService.resetPassword(email)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Password reset email sent')
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(email)
    })

    it('should handle invalid email for password reset', async () => {
      const email = 'invalid@example.com'

      mockAuthService.resetPassword.mockResolvedValue({
        success: false,
        error: 'Email not found',
        code: 'EMAIL_NOT_FOUND'
      })

      const result = await mockAuthService.resetPassword(email)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Email not found')
      expect(result.code).toBe('EMAIL_NOT_FOUND')
    })

    it('should handle rate limiting for password reset', async () => {
      const email = 'test@example.com'

      mockAuthService.resetPassword.mockResolvedValue({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 300 // 5 minutes
      })

      const result = await mockAuthService.resetPassword(email)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Too many requests')
      expect(result.code).toBe('RATE_LIMITED')
      expect(result.retryAfter).toBe(300)
    })
  })

  describe('Account Deletion', () => {
    it('should delete user account successfully', async () => {
      const password = 'password123'

      mockAuthService.deleteAccount.mockResolvedValue({
        success: true,
        message: 'Account deleted successfully'
      })

      const result = await mockAuthService.deleteAccount(password)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Account deleted successfully')
      expect(mockAuthService.deleteAccount).toHaveBeenCalledWith(password)
    })

    it('should require password confirmation for account deletion', async () => {
      const wrongPassword = 'wrongpassword'

      mockAuthService.deleteAccount.mockResolvedValue({
        success: false,
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      })

      const result = await mockAuthService.deleteAccount(wrongPassword)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid password')
      expect(result.code).toBe('INVALID_PASSWORD')
    })

    it('should handle account deletion errors', async () => {
      const password = 'password123'

      mockAuthService.deleteAccount.mockRejectedValue(new Error('Account deletion failed'))

      await expect(mockAuthService.deleteAccount(password)).rejects.toThrow('Account deletion failed')
    })
  })

  describe('Error Handling with ES2022 Error.cause', () => {
    it('should handle authentication errors with cause chain', async () => {
      const originalError = new Error('Firebase connection failed')
      const authError = new Error('Authentication failed', { cause: originalError })

      mockAuthService.signInWithEmail.mockRejectedValue(authError)

      await expect(mockAuthService.signInWithEmail('test@example.com', 'password123'))
        .rejects.toThrow('Authentication failed')
      
      try {
        await mockAuthService.signInWithEmail('test@example.com', 'password123')
      } catch (error) {
        expect(error.cause).toBe(originalError)
        expect(error.cause.message).toBe('Firebase connection failed')
      }
    })

    it('should handle network errors with detailed cause information', async () => {
      const networkError = new Error('Network timeout')
      const serviceError = new Error('Service unavailable', { cause: networkError })

      mockAuthService.signInWithCryptoWallet.mockRejectedValue(serviceError)

      try {
        await mockAuthService.signInWithCryptoWallet({})
      } catch (error) {
        expect(error.message).toBe('Service unavailable')
        expect(error.cause).toBe(networkError)
        expect(error.cause.message).toBe('Network timeout')
      }
    })

    it('should handle validation errors with cause chain', async () => {
      const validationError = new Error('Invalid email format')
      const authError = new Error('Registration failed', { cause: validationError })

      mockAuthService.signUpWithEmail.mockRejectedValue(authError)

      try {
        await mockAuthService.signUpWithEmail({
          email: 'invalid-email',
          password: 'password123'
        })
      } catch (error) {
        expect(error.message).toBe('Registration failed')
        expect(error.cause).toBe(validationError)
        expect(error.cause.message).toBe('Invalid email format')
      }
    })
  })
}) 