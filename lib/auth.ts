import { betterAuth } from 'better-auth'
import { UserRole } from '@/features/auth/types'
import { firestoreAdapter } from './auth/firestore-adapter'

export const auth = betterAuth({
  // Use custom Firestore adapter for Firebase integration
  database: firestoreAdapter(),

  // Authentication methods
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for development
    autoSignIn: true,
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      enabled: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    },
    apple: {
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
      enabled: !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
    },
  },

  // Custom user schema with Ring-specific fields (matching AuthUser interface)
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: UserRole.SUBSCRIBER,
        required: false,
      },
      wallets: {
        type: 'string', // JSON string representation of wallet array
        defaultValue: '[]',
        required: false,
      },
      isSuperAdmin: {
        type: 'boolean',
        defaultValue: false,
        required: false,
      },
      isVerified: {
        type: 'boolean',
        defaultValue: false,
        required: false,
      },
      username: {
        type: 'string',
        required: false,
      },
      authProvider: {
        type: 'string',
        defaultValue: 'email',
        required: false,
      },
      authProviderId: {
        type: 'string',
        required: false,
      },
      lastLogin: {
        type: 'date',
        required: false,
      },
      bio: {
        type: 'string',
        required: false,
      },
      canPostconfidentialOpportunities: {
        type: 'boolean',
        defaultValue: false,
        required: false,
      },
      canViewconfidentialOpportunities: {
        type: 'boolean',
        defaultValue: false,
        required: false,
      },
      postedopportunities: {
        type: 'string', // JSON string representation of array
        defaultValue: '[]',
        required: false,
      },
      savedopportunities: {
        type: 'string', // JSON string representation of array
        defaultValue: '[]',
        required: false,
      },
      nonce: {
        type: 'string',
        required: false,
      },
      nonceExpires: {
        type: 'number',
        required: false,
      },
      settings: {
        type: 'string', // JSON string representation
        defaultValue: '{"language":"en","theme":"system","notifications":true,"notificationPreferences":{"email":true,"inApp":true,"sms":false}}',
        required: false,
      },
      notificationPreferences: {
        type: 'string', // JSON string representation
        defaultValue: '{"email":true,"inApp":true,"sms":false}',
        required: false,
      },
      kycVerification: {
        type: 'string', // JSON string representation
        required: false,
      },
      pendingUpgradeRequest: {
        type: 'string', // JSON string representation
        required: false,
      },
      photoURL: {
        type: 'string',
        required: false,
      },
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },

  // Security configuration
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "fallback-secret-for-dev",
  
  // Base URL configuration
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  basePath: "/api/auth",

  // Trust host configuration
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
  ],

  // Advanced configuration
  advanced: {
    database: {
      generateId: false, // FIXED: moved from advanced.generateId to advanced.database.generateId
    },
  },
})

// Server-side session helper for BetterAuth
export const getServerSession = async (request?: Request) => {
  try {
    // Try to use BetterAuth API to get session
    if (request) {
      try {
        const sessionResponse = await auth.api.getSession({
          headers: request.headers,
        })
        return sessionResponse
      } catch (error) {
        console.warn('BetterAuth session verification failed:', error)
        return null
      }
    } else {
      // For server components without request context, 
      // try to get session using cookies from Next.js
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies() // FIXED: await cookies() in Next.js 15+
      
      try {
        // Build cookie string from all cookies
        const cookieString = cookieStore.getAll()
          .map(cookie => `${cookie.name}=${cookie.value}`)
          .join('; ')
        
        // Create a mock request with cookies for BetterAuth
        const mockRequest = new Request('http://localhost:3000', {
          headers: {
            'cookie': cookieString
          }
        })
        
        const sessionResponse = await auth.api.getSession({
          headers: mockRequest.headers,
        })
        return sessionResponse
      } catch (error) {
        console.warn('Server session retrieval failed:', error)
        return null
      }
    }
  } catch (error) {
    console.error('Failed to get server session:', error)
    return null
  }
}

// Enhanced compatibility function for server components
export const authWrapper = async (request?: Request) => {
  return await getServerSession(request)
}
