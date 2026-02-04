import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from "@/auth"
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { AuthUser } from '@/features/auth/types';
import { AdminUserManager } from '@/features/auth/components/admin-user-manager';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import AdminWrapper from '@/components/wrappers/admin-wrapper';

// Allow caching for admin users list with short revalidation for user management data
export const dynamic = "auto"
export const revalidate = 60 // 1 minute for user management data

async function getUsers(): Promise<AuthUser[]> {
  try {
    // Initialize database service with proper error handling
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      console.error('Database initialization failed:', initResult.error);
      return []; // Graceful degradation - return empty array instead of throwing
    }

    const db = getDatabaseService();

    const result = await db.query({
      collection: 'users',
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      pagination: { limit: 100 }
    });

    if (!result.success) {
      throw result.error || new Error('Failed to fetch users');
    }

    return result.data as unknown as AuthUser[];
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
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);

  return {
    title: `${t.modules.admin.userManagement} | Ring Platform`,
    description: t.modules.admin.userManagementDescription
  };
}

export default async function AdminUsersPage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/users`);
  }

  // Check if user has admin role
  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`);
  }
  
  const users = await getUsers();

  return (
    <AdminWrapper locale={validLocale} pageContext="users">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t.modules.admin.userManagement}
        </h1>
        <p className="text-muted-foreground">
          {t.modules.admin.userManagementDescription}
        </p>
      </div>

      <AdminUserManager
        initialUsers={users}
        locale={validLocale}
        translations={t}
      />
    </AdminWrapper>
  );
} 