import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import ProfileWrapper from '@/components/wrappers/profile-wrapper'
import { auth } from '@/auth'
import { AuthUser } from '@/features/auth/types'
import { WalletConductor } from '@/features/wallet/conductor/wallet-conductor'
import { getWalletBalance } from '@/app/_actions/wallet'
import { getUserByIdCached } from '@/features/auth/services/get-user-by-id'
import { LocalePageProps } from '@/utils/page-props'
import { routing } from '@/i18n/routing'
import type { Locale } from '@/i18n/shared'
import { buildLocalizedMetadata } from '@/lib/seo-metadata'
import { connection } from 'next/server'
import { logger } from '@/lib/logger'

type ProfileParams = Record<string, never>

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale: localeParam } = await params
  const locale = routing.locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : routing.defaultLocale
  setRequestLocale(locale)
  return buildLocalizedMetadata({
    locale,
    path: 'profile',
    pathname: '/profile',
    robots: { index: false, follow: false },
  })
}

export default async function ProfilePage(props: LocalePageProps<ProfileParams>) {
  await connection()

  let initialUser: AuthUser | null = null
  let error: string | null = null

  const params = await props.params
  const searchParams = await props.searchParams
  const validLocale: Locale = routing.locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : (routing.defaultLocale as Locale)

  const headersList = await headers()
  logger.info('ProfilePage: Request details', {
    validLocale,
    userAgent: headersList.get('user-agent'),
  })

  const session = await auth()
  if (!session) return null

  let fullUserData: AuthUser | null = null

  try {
    try {
      const { userMigrationService } = await import('@/features/auth/services/user-migration')
      const userExists = await userMigrationService.userDocumentExists(session.user.id)
      if (!userExists) {
        await userMigrationService.ensureUserDocument(session.user as Parameters<
          typeof userMigrationService.ensureUserDocument
        >[0])
      }

      try {
        fullUserData = (await getUserByIdCached(session.user.id)) as AuthUser
      } catch (fetchError) {
        logger.error('ProfilePage: Error fetching user data:', fetchError)
      }

      if (!userExists && fullUserData) {
        logger.warn('ProfilePage: auth.drift — session user id has profile row but userDocumentExists was false', {
          userId: session.user.id,
        })
      }
    } catch (migrationError) {
      logger.error('ProfilePage: Failed to check/create user document:', migrationError)
    }

    if (!fullUserData) {
      try {
        fullUserData = (await getUserByIdCached(session.user.id)) as AuthUser
      } catch (fetchError) {
        logger.error('ProfilePage: Error fetching user data:', fetchError)
      }
    }

    if (!fullUserData) {
      fullUserData = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        photoURL: session.user.image,
        createdAt: new Date(),
        lastLogin: new Date(),
        bio: '',
        username: null,
        phoneNumber: null,
        organization: null,
        position: null,
        wallets: [],
        isVerified: session.user.isVerified || false,
        canPostConfidentialOpportunities: false,
        canViewConfidentialOpportunities: false,
        postedOpportunities: [],
        savedOpportunities: [],
        notificationPreferences: { email: true, inApp: true, sms: false },
      } as unknown as AuthUser
    }

    let walletAddress = '';
    let userWalletBalance: string | null = null;
    try {
      const ensured = await WalletConductor.ensureNativeWallet({
        id: session.user.id,
        role: session.user.role,
      })
      const wallet = ensured.native
      if (ensured.ok && wallet?.address) {
        walletAddress = wallet.address;
        try {
          const balanceResult = await getWalletBalance(wallet);
          userWalletBalance = balanceResult.balance ?? null;
        } catch (balanceError) {
          logger.warn('ProfilePage: on-chain balance unavailable:', {
            message: balanceError instanceof Error ? balanceError.message : String(balanceError),
          });
          userWalletBalance = null;
          logger.error('ProfilePage: Error fetching wallet balance:', balanceError);
        }
      } else {
        logger.warn('ProfilePage: Wallet or wallet address is missing, skipping balance fetch.', {
          error: ensured.error,
        });
      }
    } catch (walletError) {
      logger.error('ProfilePage: ensureNativeWallet failed:', walletError);
    }


    initialUser = {
      ...session.user,
      ...fullUserData,
      id: fullUserData.id || session.user.id,
      wallets: walletAddress
        ? [
            ...(fullUserData.wallets || []),
            {
              address: walletAddress,
              balance: userWalletBalance,
              isDefault: true,
              createdAt: new Date().toISOString(),
              encryptedPrivateKey: '',
              label: 'Default Wallet',
            },
          ]
        : fullUserData.wallets || [],
      createdAt:
        fullUserData.createdAt instanceof Date
          ? fullUserData.createdAt
          : new Date(String(fullUserData.createdAt ?? Date.now())),
      lastLogin:
        fullUserData.lastLogin instanceof Date
          ? fullUserData.lastLogin
          : new Date(String(fullUserData.lastLogin ?? Date.now())),
    } as AuthUser
  } catch (e) {
    logger.error('ProfilePage: Error fetching user profile:', e)
    error = 'Failed to load user profile. Please try again later.'
  }

  return (
    <ProfileWrapper
      initialUser={initialUser}
      initialError={error}
      params={{ id: undefined, ...params }}
      searchParams={searchParams}
    />
  )
}
