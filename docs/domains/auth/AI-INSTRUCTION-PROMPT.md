# 🔐 Authentication Domain - AI Instruction Set

> **NextAuth.js v5 + Crypto Wallet Authentication with Role-Based Access Control**  
> *Complete authentication patterns for Ring Platform professional networking with unified status pages and WebSocket authentication*

---

## 🎯 **Core Authentication Functions**

### **Account Deletion System (GDPR/CCPA Compliant)**

```typescript
// Account deletion server actions - app/_actions/auth.ts
export async function requestAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to delete your account' }
  }
  
  const password = formData.get('password') as string
  const reason = formData.get('reason') as string
  
  // Password verification for security
  if (!password) {
    return { fieldErrors: { password: 'Password is required for account deletion' } }
  }
  
  try {
    // Use direct service call for account deletion request
    const { requestAccountDeletion: requestDeletionService } = await import('@/features/auth/services')
    
    const result = await requestDeletionService({
      userId: session.user.id,
      password,
      reason: reason || 'User requested account deletion',
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })
    
    if (result.success) {
      return {
        success: true,
        message: 'Account deletion requested. You have 30 days to cancel.',
        deletionDate: result.data?.deletionDate,
        canCancel: true
      }
    } else {
      return { error: result.error || 'Failed to request account deletion' }
    }
  } catch (error) {
    logger.error('Account deletion request failed:', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : error
    })
    
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function cancelAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to cancel account deletion' }
  }
  
  try {
    // Use direct service call for cancelling account deletion
    const { cancelAccountDeletion: cancelDeletionService } = await import('@/features/auth/services')
    
    const result = await cancelDeletionService({
      userId: session.user.id,
      userEmail: session.user.email || ''
    })
    
    if (result.success) {
      return {
        success: true,
        message: 'Account deletion cancelled. Your account is now active.',
        canCancel: false
      }
    } else {
      return { error: result.error || 'Failed to cancel account deletion' }
    }
  } catch (error) {
    logger.error('Account deletion cancellation failed:', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : error
    })
    
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function confirmAccountDeletion(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to confirm account deletion' }
  }
  
  try {
    // Use direct service call for final account deletion
    const { confirmAccountDeletion: confirmDeletionService } = await import('@/features/auth/services')
    
    const result = await confirmDeletionService({
      userId: session.user.id,
      userEmail: session.user.email || '',
      userName: session.user.name || ''
    })
    
    if (result.success) {
      return {
        success: true,
        message: 'Account permanently deleted. Thank you for using our platform.',
        canCancel: false
      }
    } else {
      return { error: result.error || 'Failed to confirm account deletion' }
    }
  } catch (error) {
    logger.error('Account deletion confirmation failed:', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : error
    })
    
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function getAccountDeletionStatus(
  prevState: AccountDeletionState | null,
  formData: FormData
): Promise<AccountDeletionState> {
  const session = await getServerAuthSession()
  
  if (!session?.user?.id) {
    return { error: 'You must be logged in to check deletion status' }
  }
  
  try {
    // Use direct service call to get deletion status
    const { getAccountDeletionStatus: getDeletionStatusService } = await import('@/features/auth/services')
    
    const result = await getDeletionStatusService({
      userId: session.user.id
    })
    
    if (result.success && result.data) {
      return {
        success: true,
        deletionDate: result.data.deletionDate,
        canCancel: result.data.canCancel,
        message: result.data.message
      }
    } else {
      return { 
        success: true,
        message: 'No pending account deletion found',
        canCancel: false
      }
    }
  } catch (error) {
    logger.error('Account deletion status check failed:', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : error
    })
    
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}
```

### **Account Deletion Service Implementation**

```typescript
// features/auth/services/account-deletion.ts
export async function requestAccountDeletion(
  request: AccountDeletionRequest
): Promise<ServiceResult> {
  const { userId, password, reason, userEmail, userName } = request
  
  try {
    // Verify password for security
    const userDoc = await getCachedDocument('users', userId)
    if (!userDoc) {
      return { success: false, error: 'User not found' }
    }
    
    // Password verification logic here
    // ... password verification implementation
    
    // Create deletion request with 30-day grace period
    const deletionDate = new Date()
    deletionDate.setDate(deletionDate.getDate() + 30)
    
    const deletionRecord = {
      userId,
      userEmail,
      userName,
      reason,
      requestedAt: new Date().toISOString(),
      deletionDate: deletionDate.toISOString(),
      status: 'pending',
      canCancel: true
    }
    
    await createDocument('account_deletions', userId, deletionRecord)
    
    // Update user status
    await updateDocument('users', userId, {
      accountDeletionRequested: true,
      accountDeletionDate: deletionDate.toISOString()
    })
    
    // Log audit trail
    await createDocument('audit_logs', crypto.randomUUID(), {
      action: 'account_deletion_requested',
      userId,
      userEmail,
      timestamp: new Date().toISOString(),
      details: { reason }
    })
    
    return {
      success: true,
      data: {
        deletionDate: deletionDate.toISOString(),
        canCancel: true
      }
    }
  } catch (error) {
    logger.error('Account deletion request failed:', error)
    return { success: false, error: 'Failed to request account deletion' }
  }
}

export async function cancelAccountDeletion(
  request: AccountDeletionCancel
): Promise<ServiceResult> {
  const { userId, userEmail } = request
  
  try {
    // Remove deletion request
    await deleteDocument('account_deletions', userId)
    
    // Restore user status
    await updateDocument('users', userId, {
      accountDeletionRequested: false,
      accountDeletionDate: null
    })
    
    // Log audit trail
    await createDocument('audit_logs', crypto.randomUUID(), {
      action: 'account_deletion_cancelled',
      userId,
      userEmail,
      timestamp: new Date().toISOString()
    })
    
    return { success: true }
  } catch (error) {
    logger.error('Account deletion cancellation failed:', error)
    return { success: false, error: 'Failed to cancel account deletion' }
  }
}

export async function confirmAccountDeletion(
  request: AccountDeletionConfirm
): Promise<ServiceResult> {
  const { userId, userEmail, userName } = request
  
  try {
    // Permanently delete user data
    await deleteDocument('users', userId)
    await deleteDocument('account_deletions', userId)
    
    // Delete related data (entities, opportunities, etc.)
    // ... comprehensive data deletion
    
    // Log final audit trail
    await createDocument('audit_logs', crypto.randomUUID(), {
      action: 'account_deletion_completed',
      userId,
      userEmail,
      userName,
      timestamp: new Date().toISOString()
    })
    
    return { success: true }
  } catch (error) {
    logger.error('Account deletion confirmation failed:', error)
    return { success: false, error: 'Failed to confirm account deletion' }
  }
}
```

### **NextAuth.js v5 Configuration**

```typescript
// Primary authentication setup - auth.ts
import NextAuth from "next-auth"
import { FirestoreAdapter } from "@auth/firebase-adapter"
import { getAdminDb } from "@/lib/firebase-admin.server"
import authConfig from "./auth.config"

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: FirestoreAdapter(getAdminDb()),
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    AppleProvider({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    CredentialsProvider({
      id: "crypto-wallet",
      name: "Crypto Wallet",
      credentials: {
        walletAddress: { label: "Wallet Address", type: "text" },
        signedNonce: { label: "Signed Nonce", type: "text" },
      },
      async authorize(credentials) {
        // MetaMask signature verification with ethers.js
        const signerAddress = ethers.verifyMessage(nonce, credentials.signedNonce)
        if (signerAddress !== credentials.walletAddress) return null
        
        return {
          id: credentials.walletAddress,
          role: UserRole.MEMBER,  // Higher default role for crypto users
          verificationMethod: "crypto-wallet"
        }
      }
    })
  ]
})
```

### **Role-Based Access Control System**

```typescript
// User role hierarchy with professional networking tiers
export enum UserRole {
  VISITOR = 'visitor',        // Basic platform browsing
  SUBSCRIBER = 'subscriber',  // Enhanced content access
  MEMBER = 'member',         // Entity creation, opportunity posting
  CONFIDENTIAL = 'confidential', // Premium exclusive access
  ADMIN = 'admin'            // Platform administration
}

// Access validation functions
export function hasAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.VISITOR]: 0,
    [UserRole.SUBSCRIBER]: 1,
    [UserRole.MEMBER]: 2,
    [UserRole.CONFIDENTIAL]: 3,
    [UserRole.ADMIN]: 4
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function canCreateEntity(userRole: UserRole): boolean {
  return hasAccess(userRole, UserRole.MEMBER)
}

export function canViewConfidentialContent(userRole: UserRole): boolean {
  return hasAccess(userRole, UserRole.CONFIDENTIAL)
}

export function canCreateConfidentialContent(userRole: UserRole): boolean {
  return userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
}
```

### **Session Management Patterns**

```typescript
// Server-side session handling
import { auth } from "@/auth"

// In API routes
export async function GET() {
  const session = await auth()
  
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // Type-safe user access
  const userId = session.user.id
  const userRole = session.user.role as UserRole
  
  return Response.json({ userId, userRole })
}

// In Server Components
export default async function ProtectedPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/login')
  }
  
  return <UserDashboard user={session.user} />
}

// Client-side session handling
import { useSession } from 'next-auth/react'

export function useAuthenticatedUser() {
  const { data: session, status } = useSession()
  
  return {
    user: session?.user as AuthUser | undefined,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    role: session?.user?.role as UserRole
  }
}
```

---

## 🌐 **Crypto Wallet Integration**

### **MetaMask Authentication Flow**

```typescript
// Client-side wallet connection
import { ethers } from 'ethers'
import { signIn } from 'next-auth/react'

export async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed')
  }
  
  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    })
    const walletAddress = accounts[0]
    
    // Get nonce from server
    const nonceResponse = await fetch('/api/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    })
    const { nonce } = await nonceResponse.json()
    
    // Sign nonce with MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const message = `Sign this nonce to authenticate: ${nonce}`
    const signature = await signer.signMessage(message)
    
    // Authenticate with NextAuth
    const result = await signIn('crypto-wallet', {
      walletAddress,
      signedNonce: signature,
      redirect: false
    })
    
    return result
  } catch (error) {
    console.error('MetaMask connection failed:', error)
    throw error
  }
}

// Server-side nonce generation
export async function POST(req: Request) {
  const { walletAddress } = await req.json()
  
  if (!ethers.isAddress(walletAddress)) {
    return Response.json({ error: 'Invalid wallet address' }, { status: 400 })
  }
  
  // Generate secure nonce
  const nonce = crypto.randomUUID()
  const nonceExpires = Date.now() + (5 * 60 * 1000) // 5 minutes
  
  // Store nonce in database
  const db = getAdminDb()
  await db.collection('users').doc(walletAddress).set({
    nonce,
    nonceExpires
  }, { merge: true })
  
  return Response.json({ nonce })
}
```

### **Wallet Management**

```typescript
// Wallet interface and operations
export interface Wallet {
  address: string
  encryptedPrivateKey: string
  createdAt: string
  label?: string
  isDefault: boolean
  balance: string
}

// Wallet creation and linking
export async function createWalletForUser(userId: string, walletAddress: string): Promise<void> {
  const db = getAdminDb()
  
  // Verify wallet ownership first
  const user = await db.collection('users').doc(userId).get()
  if (!user.exists) {
    throw new Error('User not found')
  }
  
  // Add wallet to user profile
  await user.ref.update({
    wallets: admin.firestore.FieldValue.arrayUnion({
      address: walletAddress,
      createdAt: new Date().toISOString(),
      isDefault: true,
      balance: '0'
    })
  })
}

// Multi-wallet support
export async function linkAdditionalWallet(
  userId: string, 
  walletAddress: string, 
  signature: string
): Promise<void> {
  // Verify signature matches address
  const recoveredAddress = ethers.verifyMessage(
    `Link wallet ${walletAddress} to account ${userId}`,
    signature
  )
  
  if (recoveredAddress !== walletAddress) {
    throw new Error('Invalid wallet signature')
  }
  
  // Add to user's wallet array
  const db = getAdminDb()
  await db.collection('users').doc(userId).update({
    wallets: admin.firestore.FieldValue.arrayUnion({
      address: walletAddress,
      createdAt: new Date().toISOString(),
      isDefault: false,
      balance: '0',
      label: 'Secondary Wallet'
    })
  })
}
```

---

## 🛡️ **Middleware Authentication**

### **Route Protection**

```typescript
// Next.js middleware with route protection
import { NextResponse } from 'next/server'
import NextAuth from "next-auth"
import authConfig from '@/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const { user } = req.auth
  
  // Public routes - no authentication required
  const publicRoutes = ['/', '/about', '/login', '/register']
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }
  
  // Protected routes - require authentication
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  // Admin routes - require admin role
  if (pathname.startsWith('/admin')) {
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }
  
  // Confidential routes - require confidential access
  if (pathname.startsWith('/confidential')) {
    if (!canViewConfidentialContent(user.role as UserRole)) {
      return NextResponse.redirect(new URL('/upgrade-access', req.url))
    }
  }
  
  // Entity creation - require member role
  if (pathname.startsWith('/entities/create')) {
    if (!canCreateEntity(user.role as UserRole)) {
      return NextResponse.redirect(new URL('/become-member', req.url))
    }
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
```

### **API Route Protection**

```typescript
// API route authentication wrapper
export function withAuth(
  handler: (req: NextRequest, context: { user: AuthUser }) => Promise<Response>
) {
  return async (req: NextRequest) => {
    const session = await auth()
    
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    return handler(req, { user: session.user as AuthUser })
  }
}

// Usage in API routes
export const POST = withAuth(async (req, { user }) => {
  // User is guaranteed to be authenticated
  const { role, id: userId } = user
  
  if (!canCreateEntity(role)) {
    return new Response('Insufficient permissions', { status: 403 })
  }
  
  // Proceed with authenticated logic
  return Response.json({ success: true })
})

// Role-specific API protection
export function withRole(requiredRole: UserRole) {
  return function(
    handler: (req: NextRequest, context: { user: AuthUser }) => Promise<Response>
  ) {
    return withAuth(async (req, { user }) => {
      if (!hasAccess(user.role, requiredRole)) {
        return new Response('Insufficient role', { status: 403 })
      }
      
      return handler(req, { user })
    })
  }
}

// Confidential content API
export const GET = withRole(UserRole.CONFIDENTIAL)(async (req, { user }) => {
  // Only confidential+ users can access
  const confidentialData = await getConfidentialContent()
  return Response.json(confidentialData)
})
```

---

## 📋 **KYC Verification System**

### **KYC Types and Status Management**

```typescript
// KYC verification levels and status
export enum KYCLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  ENHANCED = 'enhanced'
}

export enum KYCStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface KYCVerification {
  id: string
  userId: string
  level: KYCLevel
  status: KYCStatus
  submittedAt?: Date
  verifiedAt?: Date
  expiresAt?: Date
  documents: KYCDocument[]
  verificationMethod?: 'manual' | 'diia' | 'bank_id' | 'automated'
  rejectionReason?: string
}

// KYC document upload and verification
export async function submitKYCDocuments(
  userId: string,
  documents: VerificationDocument[]
): Promise<KYCVerification> {
  const db = getAdminDb()
  
  // Upload documents to secure storage
  const uploadedDocs = await Promise.all(
    documents.map(async (doc) => {
      const fileName = `kyc/${userId}/${Date.now()}_${doc.fileType}`
      const { url } = await put(fileName, doc.blobData)
      
      return {
        id: crypto.randomUUID(),
        type: doc.fileType,
        fileName,
        fileUrl: url,
        uploadedAt: new Date(),
        status: KYCStatus.PENDING
      }
    })
  )
  
  // Create KYC verification record
  const kycVerification: KYCVerification = {
    id: crypto.randomUUID(),
    userId,
    level: KYCLevel.BASIC,
    status: KYCStatus.UNDER_REVIEW,
    submittedAt: new Date(),
    documents: uploadedDocs,
    verificationMethod: 'manual'
  }
  
  // Store in database
  await db.collection('kyc_verifications').doc(kycVerification.id).set(kycVerification)
  
  return kycVerification
}
```

### **Role Upgrade System**

```typescript
// Role upgrade request management
export enum UpgradeRequestStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface RoleUpgradeRequest {
  id: string
  userId: string
  fromRole: UserRole
  toRole: UserRole
  status: UpgradeRequestStatus
  submittedAt: Date
  reason: string
  organization?: string
  position?: string
  linkedinProfile?: string
  portfolioUrl?: string
  rejectionReason?: string
}

// Submit role upgrade request
export async function requestRoleUpgrade(
  userId: string,
  toRole: UserRole,
  requestData: Partial<RoleUpgradeRequest>
): Promise<RoleUpgradeRequest> {
  const db = getAdminDb()
  
  // Get current user
  const userDoc = await db.collection('users').doc(userId).get()
  const userData = userDoc.data()
  
  if (!userData) {
    throw new Error('User not found')
  }
  
  // Validate upgrade path
  if (!isValidUpgradePath(userData.role, toRole)) {
    throw new Error('Invalid upgrade path')
  }
  
  const upgradeRequest: RoleUpgradeRequest = {
    id: crypto.randomUUID(),
    userId,
    fromRole: userData.role,
    toRole,
    status: UpgradeRequestStatus.PENDING,
    submittedAt: new Date(),
    ...requestData
  }
  
  // Store request
  await db.collection('role_upgrade_requests').doc(upgradeRequest.id).set(upgradeRequest)
  
  // Update user with pending request
  await userDoc.ref.update({
    pendingUpgradeRequest: upgradeRequest
  })
  
  return upgradeRequest
}

function isValidUpgradePath(fromRole: UserRole, toRole: UserRole): boolean {
  const validPaths = {
    [UserRole.VISITOR]: [UserRole.SUBSCRIBER],
    [UserRole.SUBSCRIBER]: [UserRole.MEMBER],
    [UserRole.MEMBER]: [UserRole.CONFIDENTIAL],
    [UserRole.CONFIDENTIAL]: [], // Cannot upgrade from confidential
    [UserRole.ADMIN]: [] // Admin is assigned manually
  }
  
  return validPaths[fromRole]?.includes(toRole) || false
}
```

---

## 🔄 **Authentication Hooks and Utilities**

### **Enhanced useAuth Hook with Status Page Integration**

```typescript
// Robust authentication hook with React 19/Next 15 compatibility
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { AuthUser, UserRole } from '@/features/auth/types'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n-config'

type AuthAction = 'login' | 'register' | 'verify' | 'reset-password' | 'kyc'
type AuthStatus = string

interface UseAuthReturn {
  user: AuthUser | null
  role: UserRole | null
  loading: boolean
  hasRole: (requiredRole: UserRole) => boolean
  isAuthenticated: boolean
  navigateToAuthStatus: (action: AuthAction, status: AuthStatus, options?: {
    email?: string
    requestId?: string
    returnTo?: string
  }) => void
  getKycStatus: () => 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | null
  refreshSession: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  
  // Loading state
  const loading = status === 'loading'
  
  // Authentication state
  const isAuthenticated = status === 'authenticated' && !!session?.user
  
  // Extract user role from session
  const role = (session?.user as any)?.role as UserRole || null
  
  // Map Auth.js session to AuthUser type
  const user: AuthUser | null = isAuthenticated && session?.user ? {
    id: session.user.id || '',
    email: session.user.email || '',
    emailVerified: (session.user as any).emailVerified || null,
    name: session.user.name || null,
    role: role || UserRole.SUBSCRIBER,
    photoURL: session.user.image || null,
    wallets: [], // Will be populated from server/database
    authProvider: (session.user as any).provider || 'credentials',
    authProviderId: session.user.id || '',
    isVerified: (session.user as any).isVerified || false,
    createdAt: new Date((session.user as any).createdAt || Date.now()),
    lastLogin: new Date((session.user as any).lastLogin || Date.now()),
    bio: (session.user as any).bio || '',
    canPostconfidentialOpportunities: role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[UserRole.CONFIDENTIAL] : false,
    canViewconfidentialOpportunities: role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[UserRole.CONFIDENTIAL] : false,
    postedopportunities: (session.user as any).postedopportunities || [],
    savedopportunities: (session.user as any).savedopportunities || [],
    notificationPreferences: {
      email: (session.user as any).notificationPreferences?.email ?? true,
      inApp: (session.user as any).notificationPreferences?.inApp ?? true,
      sms: (session.user as any).notificationPreferences?.sms ?? false,
    },
    settings: {
      language: (session.user as any).settings?.language || 'en',
      theme: (session.user as any).settings?.theme || 'light',
      notifications: (session.user as any).settings?.notifications ?? true,
      notificationPreferences: {
        email: (session.user as any).settings?.notificationPreferences?.email ?? true,
        inApp: (session.user as any).settings?.notificationPreferences?.inApp ?? true,
        sms: (session.user as any).settings?.notificationPreferences?.sms ?? false,
      },
    },
    nonce: (session.user as any).nonce,
    nonceExpires: (session.user as any).nonceExpires,
    kycVerification: (session.user as any).kycVerification,
    pendingUpgradeRequest: (session.user as any).pendingUpgradeRequest,
  } : null
  
  /**
   * Check if user has required role or higher
   */
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!isAuthenticated || !role) return false
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole]
  }

  /**
   * Navigate to auth status page
   */
  const navigateToAuthStatus = (
    action: AuthAction,
    status: AuthStatus,
    options?: {
      email?: string
      requestId?: string
      returnTo?: string
    }
  ) => {
    // Extract locale from current pathname
    const locale = pathname.split('/')[1] as Locale || 'en'
    
    // Build URL with query parameters
    const searchParams = new URLSearchParams()
    if (options?.email) searchParams.set('email', options.email)
    if (options?.requestId) searchParams.set('requestId', options.requestId)
    if (options?.returnTo) searchParams.set('returnTo', options.returnTo)
    
    const statusUrl = `/${locale}/auth/${action}/${status}`
    const finalUrl = searchParams.toString() 
      ? `${statusUrl}?${searchParams.toString()}`
      : statusUrl
    
    router.push(finalUrl)
  }

  /**
   * Get user's KYC verification status
   */
  const getKycStatus = (): 'not_started' | 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired' | null => {
    if (!user?.kycVerification) return 'not_started'
    
    const kyc = user.kycVerification
    
    // Check if expired
    if (kyc.expiresAt && new Date(kyc.expiresAt) < new Date()) {
      return 'expired'
    }
    
    // Return current status
    switch (kyc.status) {
      case 'pending':
        return 'pending'
      case 'under_review':
        return 'under_review'
      case 'approved':
        return 'approved'
      case 'rejected':
        return 'rejected'
      default:
        return 'not_started'
    }
  }

  /**
   * Refresh session data from server
   */
  const refreshSession = async (): Promise<void> => {
    try {
      await update()
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  return {
    user,
    role,
    loading,
    hasRole,
    isAuthenticated,
    navigateToAuthStatus,
    getKycStatus,
    refreshSession,
  }
}

// Role-based conditional rendering
export function useRoleAccess(requiredRole: UserRole) {
  const { role } = useAuth()
  return role ? hasAccess(role, requiredRole) : false
}

// Component-level access control
export function withRoleAccess<T extends object>(
  Component: React.ComponentType<T>,
  requiredRole: UserRole
) {
  return function RoleProtectedComponent(props: T) {
    const hasRequiredRole = useRoleAccess(requiredRole)
    const { isLoading } = useAuth()
    
    if (isLoading) {
      return <div>Loading...</div>
    }
    
    if (!hasRequiredRole) {
      return <div>Access denied. Required role: {requiredRole}</div>
    }
    
    return <Component {...props} />
  }
}
```

### **Authentication Utilities**

```typescript
// Server-side authentication utilities
export async function getServerUser(): Promise<AuthUser | null> {
  const session = await auth()
  return session?.user as AuthUser || null
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getServerUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

export async function requireRole(requiredRole: UserRole): Promise<AuthUser> {
  const user = await requireAuth()
  if (!hasAccess(user.role, requiredRole)) {
    throw new Error(`Required role: ${requiredRole}`)
  }
  return user
}

// Client-side utilities
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  
  // Add session token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('next-auth.session-token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }
  
  return headers
}

export async function apiCall(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers
    }
  })
}

### **WebSocket Authentication**

```typescript
// WebSocket authentication endpoint
// /app/api/websocket/auth/route.ts
export async function GET(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Generate short-lived JWT for WebSocket authentication
  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email,
    role: session.user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET))

  return NextResponse.json({ token, expiresIn: 3600 })
}

// WebSocket connection with authentication
import { websocketManager } from '@/lib/websocket/websocket-manager'

export function useWebSocketConnection() {
  const { isConnected, connect, disconnect } = useWebSocket()
  
  useEffect(() => {
    // Connect when authenticated
    if (session?.user) {
      connect()
    } else {
      disconnect()
    }
  }, [session, connect, disconnect])
  
  return { isConnected }
}
```
}
```

---

## ⚠️ **Error Handling**

### **Authentication Error Patterns**

```typescript
// Authentication error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class RoleError extends AuthError {
  constructor(requiredRole: UserRole, currentRole?: UserRole) {
    super(
      `Insufficient permissions. Required: ${requiredRole}, Current: ${currentRole}`,
      'INSUFFICIENT_ROLE',
      403
    )
  }
}

// Error handling in API routes
export async function handleAuthError(error: unknown): Promise<Response> {
  if (error instanceof AuthError) {
    return new Response(error.message, { 
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  if (error instanceof Error) {
    return new Response('Authentication failed', { status: 401 })
  }
  
  return new Response('Internal server error', { status: 500 })
}

// Client-side error handling
export function useAuthErrorHandler() {
  return (error: unknown) => {
    if (error instanceof AuthError) {
      if (error.code === 'INSUFFICIENT_ROLE') {
        // Redirect to upgrade page
        window.location.href = '/upgrade-access'
      } else {
        // Redirect to login
        window.location.href = '/login'
      }
    }
  }
}
```

---

## 📱 **Usage Examples**

### **Complete Authentication Flow**

```typescript
// Login page component
export default function LoginPage() {
  const [isConnecting, setIsConnecting] = useState(false)
  
  const handleMetaMaskLogin = async () => {
    setIsConnecting(true)
    try {
      const result = await connectMetaMask()
      if (result?.ok) {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsConnecting(false)
    }
  }
  
  return (
    <div className="login-container">
      <button onClick={() => signIn('google')}>
        Sign in with Google
      </button>
      
      <button onClick={() => signIn('apple')}>
        Sign in with Apple
      </button>
      
      <button 
        onClick={handleMetaMaskLogin}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
      </button>
    </div>
  )
}

// Protected dashboard component with auth status integration
export default function Dashboard() {
  const { user, isAuthenticated, hasRole, navigateToAuthStatus, getKycStatus } = useAuth()
  
  if (!isAuthenticated) {
    return <LoginRequired />
  }
  
  const handleKycFlow = () => {
    const kycStatus = getKycStatus()
    if (kycStatus === 'not_started') {
      navigateToAuthStatus('kyc', 'not_started', { 
        returnTo: '/profile' 
      })
    } else if (kycStatus === 'pending') {
      navigateToAuthStatus('kyc', 'pending', { 
        requestId: user?.kycVerification?.id 
      })
    }
  }
  
  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p>Role: {user?.role}</p>
      
      {hasRole(UserRole.MEMBER) && (
        <Link href="/entities/create">Create Entity</Link>
      )}
      
      {hasRole(UserRole.CONFIDENTIAL) && (
        <Link href="/confidential">Confidential Content</Link>
      )}
      
      {/* KYC Status Management */}
      <div className="kyc-section">
        <h3>Identity Verification</h3>
        <p>Status: {getKycStatus()}</p>
        <button onClick={handleKycFlow}>
          Manage KYC
        </button>
      </div>
    </div>
  )
}
```

---

## 🎯 **Key Implementation Notes**

1. **Always use server-side session validation** for secure operations
2. **Implement role hierarchy** - higher roles inherit lower role permissions
3. **Use middleware for route protection** - more efficient than component-level checks
4. **Crypto wallet integration requires nonce verification** for security
5. **KYC verification is required for role upgrades** to confidential tier
6. **Store sensitive data server-side only** - never expose in client components
7. **Implement proper error boundaries** for authentication failures
8. **Use TypeScript strictly** - all auth functions are fully typed
9. **Use unified status pages** for consistent authentication flow feedback
10. **Implement dynamic [action]/[status] routing** for all authentication workflows
11. **Use enhanced useAuth hook** for type-safe authentication with status page integration
12. **Implement KYC status management** through getKycStatus() helper method
13. **Use navigateToAuthStatus()** for seamless auth flow navigation to unified status pages
14. **Implement GDPR/CCPA compliant account deletion** with 30-day grace period and audit trails
15. **Use password verification** for critical account operations (deletion, role changes)
16. **Maintain complete audit logs** for all user data operations and access
17. **Follow progressive deletion flow** - Request → Grace Period → Final Deletion
18. **Use direct service calls** for server actions instead of HTTP requests to own API routes

## 🔄 **Unified Status Page Integration**

### **Auth Status Page Navigation**

```typescript
// Using useAuth hook for auth status page navigation
export function AuthFlowManager() {
  const { navigateToAuthStatus, getKycStatus, user } = useAuth()
  
  const handleLoginSuccess = () => {
    navigateToAuthStatus('login', 'success', {
      returnTo: '/dashboard'
    })
  }
  
  const handleRegistrationPending = (email: string) => {
    navigateToAuthStatus('register', 'pending_verification', {
      email,
      returnTo: '/profile'
    })
  }
  
  const handleKycSubmission = () => {
    navigateToAuthStatus('kyc', 'pending', {
      requestId: user?.kycVerification?.id,
      returnTo: '/profile'
    })
  }
  
  const handlePasswordResetEmail = (email: string) => {
    navigateToAuthStatus('reset-password', 'email_sent', {
      email
    })
  }
  
  return (
    <div>
      <button onClick={handleLoginSuccess}>Simulate Login Success</button>
      <button onClick={() => handleRegistrationPending('user@example.com')}>
        Simulate Registration Pending
      </button>
      <button onClick={handleKycSubmission}>Simulate KYC Submission</button>
      <button onClick={() => handlePasswordResetEmail('user@example.com')}>
        Simulate Password Reset Email
      </button>
    </div>
  )
}
```

### **KYC Status Management**

```typescript
// KYC workflow with status page integration
export function KYCWorkflow() {
  const { getKycStatus, navigateToAuthStatus, user } = useAuth()
  
  const handleKycFlow = () => {
    const status = getKycStatus()
    
    switch (status) {
      case 'not_started':
        navigateToAuthStatus('kyc', 'not_started', {
          returnTo: '/profile'
        })
        break
      case 'pending':
        navigateToAuthStatus('kyc', 'pending', {
          requestId: user?.kycVerification?.id
        })
        break
      case 'under_review':
        navigateToAuthStatus('kyc', 'under_review', {
          requestId: user?.kycVerification?.id
        })
        break
      case 'approved':
        navigateToAuthStatus('kyc', 'approved', {
          returnTo: '/profile'
        })
        break
      case 'rejected':
        navigateToAuthStatus('kyc', 'rejected', {
          requestId: user?.kycVerification?.id
        })
        break
      case 'expired':
        navigateToAuthStatus('kyc', 'expired', {
          returnTo: '/profile'
        })
        break
    }
  }
  
  return (
    <div>
      <h3>KYC Status: {getKycStatus()}</h3>
      <button onClick={handleKycFlow}>
        Manage KYC Process
      </button>
    </div>
  )
}
```

### **Authentication Status Pages**

```typescript
// Dynamic status page routing
// app/(public)/[locale]/auth/status/[action]/[status]/page.tsx

// Supported actions: login, register, verify, reset-password, kyc
// Supported statuses: success, failure, pending, expired, etc.

// Status page component with i18n support
<AuthStatusPage 
  action="login" 
  status="success" 
  locale="en"
  returnTo="/dashboard"
/>
```

### **Status Page Benefits**

- **Consistent UX** across all authentication flows
- **Centralized i18n** for status messages
- **SEO-friendly** with dynamic metadata
- **Accessibility** with proper ARIA labels
- **Error handling** with contextual guidance

This authentication system provides enterprise-grade security with Web3 integration and unified status page patterns, perfect for Ring Platform's professional networking requirements.