/** Client-safe personal-page analytics shapes (no server-only). */

export type PersonalPageRoleBucket = {
  role: string
  unique: number
  visits: number
}

export type PersonalPageVisitStats = {
  unique24h: number
  unique7d: number
  visits24h: number
  visits7d: number
  byRole24h: PersonalPageRoleBucket[]
  byRole7d: PersonalPageRoleBucket[]
  /** Unique hits on private shell (24h / 7d). */
  privateUnique24h: number
  privateUnique7d: number
  hasData: boolean
}

/** @deprecated Prefer unique24h / unique7d — kept for profile widget transition. */
export type PersonalPageViewStats = PersonalPageVisitStats & {
  today: number
  last7d: number
}
