/**
 * Zemna.AI Publication Service – Phase 2
 * Uses ring-db *Doc methods (findDocById, createDoc, updateDoc, deleteDoc, findDocs).
 */

import { db } from '@/lib/database'
import type { DbRow } from '@/lib/database'
import type {
  Publication,
  PublicationVersion,
  CreatePublicationInput,
  UpdatePublicationInput,
  PublicationVersionData,
  PublicationData,
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

type PublicationRow = DbRow<PublicationData & Record<string, unknown>>
type VersionRow = DbRow<PublicationVersionData & Record<string, unknown>>

function parseMetaDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  return new Date()
}

function rowToPublication(row: PublicationRow): Publication {
  const { id, user_id, title, content, status, template_id, createdAt, updatedAt, version } = row
  return {
    id,
    data: {
      user_id: String(user_id),
      title: String(title ?? ''),
      content: (content as Record<string, unknown>) ?? {},
      status: status as PublicationData['status'],
      template_id: template_id as string | undefined,
    },
    metadata: {
      createdAt: parseMetaDate(createdAt),
      updatedAt: parseMetaDate(updatedAt),
      version: Number(version ?? 1),
    },
  }
}

function rowToVersion(row: VersionRow): PublicationVersion {
  const {
    id,
    publication_id,
    version_number,
    content,
    change_summary,
    created_by,
    createdAt,
    updatedAt,
    version,
  } = row
  return {
    id,
    data: {
      publication_id: String(publication_id),
      version_number: Number(version_number),
      content: (content as Record<string, unknown>) ?? {},
      change_summary: change_summary as string | undefined,
      created_by: created_by as string | undefined,
    },
    metadata: {
      createdAt: parseMetaDate(createdAt),
      updatedAt: parseMetaDate(updatedAt),
      version: Number(version ?? 1),
    },
  }
}

export async function listPublicationsByUserId(userId: string): Promise<ListPublicationsResult> {
  try {
    const result = await db().findDocs<PublicationData>(
      COLLECTION_PUBLICATIONS,
      [{ field: 'user_id', operator: '=', value: userId }],
      { orderBy: [{ field: 'updated_at', direction: 'desc' }], limit: 100 }
    )
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: (result.data ?? []).map(rowToPublication) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list publications',
    }
  }
}

export async function getPublicationById(id: string): Promise<GetPublicationResult> {
  try {
    const result = await db().findDocById<PublicationData>(COLLECTION_PUBLICATIONS, id)
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return {
      success: true,
      data: result.data ? rowToPublication(result.data as PublicationRow) : null,
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to get publication',
    }
  }
}

export async function createPublication(
  userId: string,
  input: CreatePublicationInput = {}
): Promise<CreatePublicationResult> {
  try {
    const data: PublicationData = {
      user_id: userId,
      title: input.title ?? 'Untitled Publication',
      content: input.content ?? {},
      status: input.status ?? 'draft',
      template_id: input.template_id,
    }
    const result = await db().createDoc(COLLECTION_PUBLICATIONS, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: rowToPublication(result.data as PublicationRow) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to create publication',
    }
  }
}

export async function updatePublication(
  id: string,
  input: UpdatePublicationInput
): Promise<UpdatePublicationResult> {
  try {
    const payload: Partial<PublicationData> = {}
    if (input.title !== undefined) payload.title = input.title
    if (input.content !== undefined) payload.content = input.content
    if (input.status !== undefined) payload.status = input.status
    if (input.template_id !== undefined) payload.template_id = input.template_id
    if (Object.keys(payload).length === 0) {
      return getPublicationById(id) as Promise<UpdatePublicationResult>
    }
    const result = await db().updateDoc<PublicationData>(COLLECTION_PUBLICATIONS, id, payload, {
      merge: true,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: rowToPublication(result.data as PublicationRow) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to update publication',
    }
  }
}

export async function deletePublication(id: string): Promise<DeletePublicationResult> {
  try {
    const result = await db().deleteDoc(COLLECTION_PUBLICATIONS, id)
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete publication',
    }
  }
}

export async function listVersionsByPublicationId(
  publicationId: string
): Promise<ListVersionsResult> {
  try {
    const result = await db().findDocs<PublicationVersionData>(
      COLLECTION_VERSIONS,
      [{ field: 'publication_id', operator: '=', value: publicationId }],
      { orderBy: [{ field: 'created_at', direction: 'desc' }], limit: 50 }
    )
    if (!result.success) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: (result.data ?? []).map(rowToVersion) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to list versions',
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
    const listResult = await db().findDocs<PublicationVersionData>(
      COLLECTION_VERSIONS,
      [{ field: 'publication_id', operator: '=', value: publicationId }],
      { limit: 1, orderBy: [{ field: 'created_at', direction: 'desc' }] }
    )
    const latest = listResult.success && listResult.data?.length ? listResult.data[0] : null
    const lastVersion =
      latest && typeof latest.version_number === 'number' ? latest.version_number : 0
    const nextVersion = lastVersion + 1
    const data: PublicationVersionData = {
      publication_id: publicationId,
      version_number: nextVersion,
      content,
      change_summary: changeSummary,
      created_by: createdBy,
    }
    const result = await db().createDoc(COLLECTION_VERSIONS, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error?.message }
    }
    return { success: true, data: rowToVersion(result.data as VersionRow) }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to create version',
    }
  }
}
