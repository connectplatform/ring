import { betterAuth } from 'better-auth'
import { UserRole } from '@/features/auth/types'

export const auth = betterAuth({
  // For now, let's use memory storage to get BetterAuth working
  // We'll implement Firestore integration through hooks and callbacks
  // database: undefined, // Uses default memory adapter
  
  // Enable storage-less mode for initial testing
  database: {
    provider: "sqlite",
    url: ":memory:", // In-memory SQLite for testing
  },

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
    generateId: false,
  },

  // Hooks to sync with Firestore
  hooks: {
    after: [
      {
        matcher(context) {
          return context.path?.startsWith("/sign-in") || context.path?.startsWith("/sign-up") || context.path?.startsWith("/callback")
        },
        async handler(context) {
          // Sync user data with Firestore after successful authentication
          if (context.user && context.session) {
            try {
              const { getAdminDb } = await import('@/lib/firebase-admin.server')
              const db = getAdminDb()
              
              const userRef = db.collection('users').doc(context.user.id)
              const userDoc = await userRef.get()
              
              const userData = {
                id: context.user.id,
                email: context.user.email || '',
                name: context.user.name || '',
                image: context.user.image || null,
                emailVerified: context.user.emailVerified || null,
                role: UserRole.SUBSCRIBER,
                wallets: JSON.stringify([]),
                isSuperAdmin: false,
                isVerified: Boolean(context.user.emailVerified),
                authProvider: context.account?.providerId || 'email',
                authProviderId: context.account?.providerAccountId || context.user.id,
                lastLogin: new Date(),
                settings: JSON.stringify({
                  language: 'en',
                  theme: 'system',
                  notifications: true,
                  notificationPreferences: { email: true, inApp: true, sms: false }
                }),
                notificationPreferences: JSON.stringify({ email: true, inApp: true, sms: false }),
                canPostconfidentialOpportunities: false,
                canViewconfidentialOpportunities: false,
                postedopportunities: JSON.stringify([]),
                savedopportunities: JSON.stringify([]),
                createdAt: new Date(),
                updatedAt: new Date(),
              }

              if (userDoc.exists) {
                // Update existing user
                await userRef.update({
                  ...userData,
                  createdAt: userDoc.data()?.createdAt || new Date(),
                })
              } else {
                // Create new user
                await userRef.set(userData)
              }
              
              console.log('✅ User synced with Firestore:', context.user.email)
            } catch (error) {
              console.error('❌ Failed to sync user with Firestore:', error)
            }
          }
        }
      }
    ]
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
