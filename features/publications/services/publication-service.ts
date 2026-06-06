/**
 * Zemna.AI Publication Service – Phase 2
 * Uses Ring DatabaseService (findById, create, update, findByField).
 */

import { getDatabaseService, initializeDatabase } from '@/lib/database'
import type {
  Publication,
  PublicationVersion,
  CreatePublicationInput,
  UpdatePublicationInput,
  PublicationVersionData
} from '@/features/publications/types'

const COLLECTION_PUBLICATIONS = 'publications'
const COLLECTION_VERSIONS = 'publication_versions'

export interface ListPublicationsResult {
  success: boolean
  data?: Publication[]
  error?: string
}

export interface GetPublicationResult {
  success: boolean
  data?: Publication | null
  error?: string
}

export interface CreatePublicationResult {
  success: boolean
  data?: Publication
  error?: string
}

export interface UpdatePublicationResult {
  success: boolean
  data?: Publication
  error?: string
}

export interface DeletePublicationResult {
  success: boolean
  error?: string
}

export interface ListVersionsResult {
  success: boolean
  data?: PublicationVersion[]
  error?: string
}

export interface CreateVersionResult {
  success: boolean
  data?: PublicationVersion
  error?: string
}

async function ensureDb() {
  const initResult = await initializeDatabase()
  if (!initResult.success) {
    throw new Error('Database initialization failed')
  }
  return getDatabaseService()
}

export async function listPublicationsByUserId(userId: string): Promise<ListPublicationsResult> {
  try {
    const db = await ensureDb()
    const result = await db.findByField<Publication['data']>(
      COLLECTION_PUBLICATIONS,
      'user_id',
      userId,
      { orderBy: { field: 'updated_at', direction: 'desc' }, limit: 100 }
    )
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: (result.data as Publication[]) || [] }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list publications'
    }
  }
}

export async function getPublicationById(id: string): Promise<GetPublicationResult> {
  try {
    const db = await ensureDb()
    const result = await db.findById<Publication['data']>(COLLECTION_PUBLICATIONS, id)
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: result.data as Publication | null }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to get publication'
    }
  }
}

export async function createPublication(
  userId: string,
  input: CreatePublicationInput = {}
): Promise<CreatePublicationResult> {
  try {
    const db = await ensureDb()
    const data: Publication['data'] = {
      user_id: userId,
      title: input.title ?? 'Untitled Publication',
      content: input.content ?? {},
      status: input.status ?? 'draft',
      template_id: input.template_id
    }
    const result = await db.create<Publication['data']>(COLLECTION_PUBLICATIONS, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: result.data as Publication }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to create publication'
    }
  }
}

export async function updatePublication(
  id: string,
  input: UpdatePublicationInput
): Promise<UpdatePublicationResult> {
  try {
    const db = await ensureDb()
    const payload: Partial<Publication['data']> = {}
    if (input.title !== undefined) payload.title = input.title
    if (input.content !== undefined) payload.content = input.content
    if (input.status !== undefined) payload.status = input.status
    if (input.template_id !== undefined) payload.template_id = input.template_id
    if (Object.keys(payload).length === 0) {
      const getResult = await db.findById<Publication['data']>(COLLECTION_PUBLICATIONS, id)
      if (!getResult.success || !getResult.data) {
        return { success: false, error: getResult.error?.message ?? 'Publication not found' }
      }
      return { success: true, data: getResult.data as Publication }
    }
    const result = await db.update<Publication['data']>(COLLECTION_PUBLICATIONS, id, payload, {
      merge: true
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: result.data as Publication }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to update publication'
    }
  }
}

export async function deletePublication(id: string): Promise<DeletePublicationResult> {
  try {
    const db = await ensureDb()
    const result = await db.delete(COLLECTION_PUBLICATIONS, id)
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete publication'
    }
  }
}

export async function listVersionsByPublicationId(
  publicationId: string
): Promise<ListVersionsResult> {
  try {
    const db = await ensureDb()
    const result = await db.findByField<PublicationVersionData>(
      COLLECTION_VERSIONS,
      'publication_id',
      publicationId,
      { orderBy: { field: 'created_at', direction: 'desc' }, limit: 50 }
    )
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: (result.data as PublicationVersion[]) || [] }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list versions'
    }
  }
}

export async function createVersion(
  publicationId: string,
  content: Record<string, unknown>,
  createdBy: string,
  changeSummary?: string
): Promise<CreateVersionResult> {
  try {
    const db = await ensureDb()
    const listResult = await db.findByField<PublicationVersionData>(
      COLLECTION_VERSIONS,
      'publication_id',
      publicationId,
      { limit: 1, orderBy: { field: 'created_at', direction: 'desc' } }
    )
    const latest = listResult.success && listResult.data?.length ? listResult.data[0] : null
    const lastVersion = latest && typeof (latest as { data?: { version_number?: number } }).data?.version_number === 'number'
      ? (latest as { data: { version_number: number } }).data.version_number
      : 0
    const nextVersion = lastVersion + 1
    const data: PublicationVersionData = {
      publication_id: publicationId,
      version_number: nextVersion,
      content,
      change_summary: changeSummary,
      created_by: createdBy
    }
    const result = await db.create<PublicationVersionData>(COLLECTION_VERSIONS, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: result.data as PublicationVersion }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to create version'
    }
  }
}
