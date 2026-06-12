import type { SerializedEntity } from '@/features/entities/types'

export type MyEntitiesView = 'all' | 'store' | 'member'

export interface MyEntitiesCounts {
  all: number
  store: number
  member: number
}

export function parseMyEntitiesView(value: string | undefined): MyEntitiesView {
  if (value === 'store' || value === 'member') return value
  return 'all'
}

export function matchesMyEntitiesView(
  entity: SerializedEntity,
  userId: string,
  view: MyEntitiesView,
): boolean {
  switch (view) {
    case 'store':
      return entity.addedBy === userId && entity.storeActivated === true
    case 'member':
      return (
        entity.addedBy !== userId &&
        Array.isArray(entity.members) &&
        entity.members.includes(userId)
      )
    case 'all':
    default:
      return entity.addedBy === userId
  }
}

export function computeMyEntitiesCounts(
  entities: SerializedEntity[],
  userId: string,
): MyEntitiesCounts {
  let store = 0
  let member = 0

  for (const entity of entities) {
    if (entity.addedBy === userId && entity.storeActivated) store += 1
    if (
      entity.addedBy !== userId &&
      entity.members?.includes(userId)
    ) {
      member += 1
    }
  }

  const owned = entities.filter((e) => e.addedBy === userId).length

  return {
    all: owned,
    store,
    member,
  }
}
