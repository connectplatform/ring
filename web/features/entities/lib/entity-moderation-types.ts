/** Platform moderation state stored on entity JSONB documents. */
export type EntityModerationStatus =
  | 'active'
  | 'reported'
  | 'under_review'
  | 'blocked'

export type EntityReportCategory =
  | 'spam'
  | 'illegal'
  | 'misleading'
  | 'harassment'
  | 'other'

export interface EntityReportRecord {
  id: string
  entityId: string
  reporterUserId: string
  category: EntityReportCategory
  reason: string
  status: 'open' | 'reviewed' | 'dismissed'
  createdAt: string
}

export interface MatcherModerationEvent {
  type: 'entity_reported' | 'entity_blocked' | 'entity_user_blocked'
  entityId: string
  actorUserId: string
  category?: EntityReportCategory
  reason?: string
  summary?: string
  createdAt: string
}
