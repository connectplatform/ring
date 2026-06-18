import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from "@/auth"
import { db } from '@/lib/database';
import { AuthUser } from '@/features/auth/types';
import { AdminUserManager } from '@/features/auth/components/admin-user-manager';
import type { Locale } from '@/i18n/shared';
import { routing } from '@/i18n/routing';
import { ROUTES } from '@/constants/routes';
import { getTranslations } from 'next-intl/server';
import AdminWrapper from '@/components/wrappers/admin-wrapper';
import { connection } from 'next/server'
import { buildModulesAdminLabels } from '@/features/admin/admin-labels';
import { isPlatformAdmin } from '@/features/auth/user-role';
import { AdminSystemOverview } from '@/components/admin/admin-system-overview';

async function getUsers(): Promise<AuthUser[]> {
  try {
    const result = await db().queryDocs<Record<string, unknown>>({
      collection: 'users',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 },
    })

    if (!result.success || !result.data) {
      throw result.error || new Error('Failed to fetch users')
    }

    return result.data.map((row) => {
      const data = row as Record<string, unknown>
      return {
        id: String(data.id ?? ''),
        email: String(data.email ?? ''),
        name: (data.name as string | null) ?? null,
        role: (data.role as AuthUser['role']) ?? 'subscriber',
        isVerified: Boolean(data.isVerified ?? data.is_verified ?? false),
        createdAt: data.createdAt ? new Date(String(data.createdAt)) : new Date(),
        lastLogin: data.lastLogin ? new Date(String(data.lastLogin)) : new Date(),
        photoURL: (data.photoURL as string | null) ?? null,
        emailVerified: data.emailVerified ? new Date(String(data.emailVerified)) : null,
        authProvider: String(data.authProvider ?? 'credentials'),
        authProviderId: String(data.authProviderId ?? data.id ?? ''),
        globalUserId: String(data.global_user_id ?? data.id ?? ''),
        accountStatus: (data.account_status as AuthUser['accountStatus']) ?? 'ACTIVE',
        wallets: Array.isArray(data.wallets) ? data.wallets : [],
      } as AuthUser
    })
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function generateMetadata({ 
  params 
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');

  return {
    title: `${t('userManagement')} | Zemna AI`,
    description: t('userManagementDescription')
  };
}

export default async function AdminUsersPage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  await connection() // Next.js 16: opt out of prerendering

  const { locale } = await params;
  const validLocale: Locale = routing.locales.includes(locale as Locale) ? (locale as Locale) : (routing.defaultLocale as Locale);
  const t = await getTranslations('modules.admin');

  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`${ROUTES.LOGIN(validLocale)}?callbackUrl=${encodeURIComponent(ROUTES.ADMIN_USERS(validLocale))}`);
  }

  if (!isPlatformAdmin(session.user.role)) {
    redirect(ROUTES.UNAUTHORIZED(validLocale));
  }
  
  const users = await getUsers();
  const adminLabels = buildModulesAdminLabels(t);

  return (
    <AdminWrapper locale={validLocale} pageContext="users" labels={adminLabels}>
      <div className="container mx-auto px-0 py-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('userManagement')}
          </h1>
          <p className="text-muted-foreground">
            {t('userManagementDescription')}
          </p>
        </div>

        <AdminUserManager
          initialUsers={users}
          locale={validLocale}
        />

        <AdminSystemOverview locale={validLocale} labels={adminLabels} />
      </div>
    </AdminWrapper>
  );
}
