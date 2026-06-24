// @ts-nocheck
import { describe, expect, it } from '@jest/globals'
import { UserRole } from '@/features/auth/user-role'
import {
  buildNewsVisibilityFilters,
  canViewNewsArticle,
  getAllowedNewsVisibilityValues,
} from '@/features/news/lib/news-visibility-filter'

describe('news-visibility-filter', () => {
  it('visitor sees public and site-wide only', () => {
    expect(getAllowedNewsVisibilityValues(UserRole.visitor)).toEqual([
      'public',
      'site-wide',
    ])
  })

  it('admin has unrestricted list filters', () => {
    expect(getAllowedNewsVisibilityValues(UserRole.admin)).toBeNull()
  })

  it('buildNewsVisibilityFilters excludes confidential for subscribers', () => {
    const filters = buildNewsVisibilityFilters(UserRole.subscriber)
    expect(filters).toEqual(
      expect.arrayContaining([
        { field: 'visibility', operator: 'in', value: ['public', 'subscriber', 'site-wide'] },
        { field: 'visibility', operator: '!=', value: 'confidential' },
      ]),
    )
  })

  it('canViewNewsArticle blocks confidential for member', () => {
    expect(
      canViewNewsArticle(
        { visibility: 'confidential', authorId: 'a1' },
        { userRole: UserRole.member, userId: 'u1' },
      ),
    ).toBe(false)
  })

  it('canViewNewsArticle allows blog-only for author', () => {
    expect(
      canViewNewsArticle(
        { visibility: 'blog-only', authorId: 'u1' },
        { userRole: UserRole.member, userId: 'u1' },
      ),
    ).toBe(true)
  })

  it('canViewNewsArticle allows site-wide for visitor', () => {
    expect(
      canViewNewsArticle(
        { visibility: 'site-wide', authorId: 'a1' },
        { userRole: UserRole.visitor },
      ),
    ).toBe(true)
  })
})
