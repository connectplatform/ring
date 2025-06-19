// import { useState, useEffect } from 'react'
// import { useRouter } from 'next/navigation'
// import { useSession, signIn, signOut } from 'next-auth/react'
// import { ROUTES } from '@/constants/routes'
// import { AuthUser, UserRole, UserSettings } from '@/features/auth/types'

// interface AuthState {
//   user: AuthUser | null
//   loading: boolean
//   role: UserRole | null
// }

// export function useAuth() {
//   const [authState, setAuthState] = useState<AuthState>({ user: null, loading: true, role: null })
//   const router = useRouter()
//   const { data: session, status } = useSession()

//   useEffect(() => {
//     if (status === 'loading') {
//       setAuthState({ user: null, loading: true, role: null })
//     } else if (status === 'authenticated' && session?.user) {
//       const user: AuthUser = {
//         id: session.user.id,
//         email: session.user.email || '',
//         emailVerified: session.user.emailVerified || null,
//         name: session.user.name || null,
//         role: (session.user as any).role || UserRole.SUBSCRIBER,
//         photoURL: session.user.image || undefined,
//         walletAddress: (session.user as any).walletAddress,
//         authProvider: (session.user as any).provider || 'credentials',
//         authProviderId: session.user.id,
//         walletBalance: (session.user as any).walletBalance,
//         isVerified: (session.user as any).isVerified || false,
//         createdAt: (session.user as any).createdAt ? new Date((session.user as any).createdAt) : new Date(),
//         lastLogin: (session.user as any).lastLogin ? new Date((session.user as any).lastLogin) : new Date(),
//         settings: {
//           language: 'en',
//           theme: 'light',
//           notifications: true,
//           notificationPreferences: {
//             email: true,
//             inApp: true,
//             sms: false,
//           },
//         },
//         bio: '',
//         canPostconfidentialOpportunities: false,
//         canViewconfidentialOpportunities: false,
//         postedopportunities: [],
//         savedopportunities: [],
//         notificationPreferences: {
//           email: true,
//           inApp: true,
//         },
//         getIdTokenResult: async (forceRefresh?: boolean) => {
//           // This is a placeholder implementation
//           return {
//             claims: {},
//             token: '',
//             authTime: '',
//             issuedAtTime: '',
//             expirationTime: '',
//             signInProvider: null,
//             signInSecondFactor: null,
//           }
//         },
//       }
//       setAuthState({ user, loading: false, role: user.role })
//     } else {
//       setAuthState({ user: null, loading: false, role: null })
//     }
//   }, [session, status])

//   const refreshUserRole = async () => {
//     try {
//       const response = await fetch('/api/auth/refresh-role')
//       if (response.ok) {
//         const { role } = await response.json()
//         setAuthState(prevState => ({
//           ...prevState,
//           role: role as UserRole,
//           user: prevState.user ? { ...prevState.user, role: role as UserRole } : null
//         }))
//         return role as UserRole
//       }
//     } catch (error) {
//       console.error('Error refreshing user role:', error)
//     }
//     return null
//   }

//   const signInWithGoogle = async () => {
//     try {
//       const result = await signIn('google', { callbackUrl: ROUTES.PROFILE })
//       if (result?.error) {
//         console.error('Error signing in with Google:', result.error)
//         throw new Error(result.error)
//       }
//     } catch (error) {
//       console.error('Error signing in with Google:', error)
//       throw error
//     }
//   }

//   const handleSignOut = async () => {
//     try {
//       await signOut({ callbackUrl: ROUTES.HOME })
//       setAuthState({ user: null, loading: false, role: null })
//     } catch (error) {
//       console.error('Error signing out:', error)
//       throw error
//     }
//   }

//   const updateUserProfile = async (data: Partial<AuthUser>) => {
//     if (authState.user) {
//       try {
//         const response = await fetch('/api/auth/update-profile', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(data),
//         })
//         if (response.ok) {
//           const updatedUser = await response.json()
//           setAuthState(prevState => ({
//             ...prevState,
//             user: { ...prevState.user!, ...updatedUser }
//           }))
//         } else {
//           throw new Error('Failed to update profile')
//         }
//       } catch (error) {
//         console.error('Error updating user profile:', error)
//         throw error
//       }
//     }
//   }

//   return {
//     user: authState.user,
//     loading: authState.loading,
//     role: authState.role,
//     refreshUserRole,
//     signInWithGoogle,
//     signOut: handleSignOut,
//     updateUserProfile,
//   }
// }

