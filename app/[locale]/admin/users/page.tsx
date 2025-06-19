import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase-admin.server';
import { AuthUser } from '@/features/auth/types';
import { AdminUserManager } from '@/features/auth/components/AdminUserManager';
import { isValidLocale, defaultLocale, loadTranslations } from '@/utils/i18n-server';

export const dynamic = 'force-dynamic';

async function getUsers(): Promise<AuthUser[]> {
  try {
    const db = getAdminDb();
    const usersCollection = db.collection('users');
    const snapshot = await usersCollection
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuthUser[];
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
    title: `${t.admin.userManagement} | Ring Platform`,
    description: t.admin.userManagementDescription,
    robots: 'noindex, nofollow', // Admin pages should not be indexed
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t.admin.userManagement}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t.admin.userManagementDescription}
        </p>
      </div>

      <AdminUserManager 
        initialUsers={users}
        locale={validLocale}
        translations={t}
      />
    </div>
  );
} 