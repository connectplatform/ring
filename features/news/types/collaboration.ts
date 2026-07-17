/**
 * News collaboration / revision types (Zemna Phase 4 mapped onto news).
 */

export type NewsCollaboratorRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer'

export type NewsRevisionStatus =
  | 'pending-revision'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'

export type NewsCollaborationPermission = {
  can_edit: boolean
  can_comment: boolean
  can_suggest: boolean
  can_resolve: boolean
}

export type NewsRevision = {
  id: string
  articleId: string
  articleTitle?: string
  articleSlug?: string
  baseContent: string
  proposedContent: string
  proposedJson?: Record<string, unknown>
  status: NewsRevisionStatus
  proposerId: string
  proposerName: string
  diffSummary?: { added: number; removed: number }
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export type NewsCollaborator = {
  id: string
  articleId: string
  userId: string
  role: NewsCollaboratorRole
  status: 'pending' | 'accepted' | 'revoked'
  permissions?: Partial<NewsCollaborationPermission>
  createdAt: string
  acceptedAt?: string
}

export type NewsCollaborationInvite = {
  id: string
  articleId: string
  email: string
  role: NewsCollaboratorRole
  token: string
  expiresAt: string
  invitedBy: string
  createdAt: string
}

export const ROLE_DEFAULT_PERMISSIONS: Record<
  NewsCollaboratorRole,
  NewsCollaborationPermission
> = {
  owner: { can_edit: true, can_comment: true, can_suggest: true, can_resolve: true },
  admin: { can_edit: true, can_comment: true, can_suggest: true, can_resolve: true },
  editor: { can_edit: true, can_comment: true, can_suggest: true, can_resolve: false },
  reviewer: { can_edit: false, can_comment: true, can_suggest: true, can_resolve: false },
  viewer: { can_edit: false, can_comment: false, can_suggest: false, can_resolve: false },
}
