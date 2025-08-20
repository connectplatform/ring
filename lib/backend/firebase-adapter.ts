import { getAdminDb } from '@/lib/firebase-admin.server'
import type { BackendAdapter, QueryFilters } from './types'

export class FirebaseBackendAdapter implements BackendAdapter {
  async create<T>(collection: string, data: T): Promise<{ id: string; data: T }> {
    const db = await getAdminDb()
    const ref = await db.collection(collection).add(data as any)
    const snap = await ref.get()
    return { id: ref.id, data: { id: ref.id, ...(snap.data() as any) } as any }
  }

  async read<T>(collection: string, id: string): Promise<T | null> {
    const db = await getAdminDb()
    const snap = await db.collection(collection).doc(id).get()
    return snap.exists ? ({ id: snap.id, ...(snap.data() as any) } as any) : null
  }

  async update<T>(collection: string, id: string, data: Partial<T>): Promise<void> {
    const db = await getAdminDb()
    await db.collection(collection).doc(id).update(data as any)
  }

  async delete(collection: string, id: string): Promise<void> {
    const db = await getAdminDb()
    await db.collection(collection).doc(id).delete()
  }

  async query<T>(collection: string, filters: QueryFilters): Promise<Array<{ id: string; data: T }>> {
    const db = await getAdminDb()
    let q: any = db.collection(collection)

    if (filters.where) {
      for (const w of filters.where) {
        q = q.where(w.field, w.op as any, w.value)
      }
    }
    if (filters.orderBy) {
      for (const o of filters.orderBy) {
        q = q.orderBy(o.field, (o.direction || 'asc') as any)
      }
    }
    if (filters.limit) {
      q = q.limit(filters.limit)
    }
    if (filters.startAfterId) {
      const doc = await db.collection(collection).doc(filters.startAfterId).get()
      if (doc.exists) q = q.startAfter(doc)
    }

    const snap = await q.get()
    return snap.docs.map((d: any) => ({ id: d.id, data: { id: d.id, ...(d.data() as any) } }))
  }
}


