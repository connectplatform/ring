import type { AuthUser } from '@/features/auth/types'
import { UserRolesArray } from '@/features/auth/user-role'

export interface AdminUserStats {
  totalUsers: number
  activeUsers: number
  newUsersThisMonth: number
  newUsersToday: number
  usersByRole: Record<string, number>
  verifiedUsers: number
  unverifiedUsers: number
}

/**
 * Compute admin user overview stats from a users list (SSOT for admin Users page).
 * Active = lastLogin within the last 30 days.
 */
export function computeAdminUserStats(users: AuthUser[]): AdminUserStats {
  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const usersByRole = users.reduce(
    (acc, user) => {
      const role = String(user.role || UserRolesArray.visitor)
      acc[role] = (acc[role] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => {
      if (!user.lastLogin) return false
      return new Date(user.lastLogin) > thirtyDaysAgo
    }).length,
    newUsersThisMonth: users.filter((user) => new Date(user.createdAt) > thisMonth).length,
    newUsersToday: users.filter((user) => new Date(user.createdAt) >= startOfToday).length,
    usersByRole,
    verifiedUsers: users.filter((user) => user.isVerified).length,
    unverifiedUsers: users.filter((user) => !user.isVerified).length,
  }
}
