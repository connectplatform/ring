/**
 * Re-export client-safe personal-page stats types from analytics SSOT.
 * Kept as a thin auth-path alias so profile widget imports stay stable.
 */
export type {
  PersonalPageRoleBucket,
  PersonalPageVisitStats,
  PersonalPageViewStats,
} from '@/features/analytics/types/personal-page'
