/**
 * Device telemetry persistence — Ring Analytics layer.
 * Upserts last-known snapshot per (userId, deviceId, domain) for fraud forensics + UX signals.
 */

import 'server-only'

import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { db } from '@/lib/database'
import {
  REALTIME_DATA_DOMAINS,
  type RealtimeDataDomain,
} from '@/lib/tunnel/realtime-data-types'
import { isAnalyticsStorageDisabled } from '@/features/analytics/lib/analytics-db'

export const USER_DEVICE_TELEMETRY = 'user_device_telemetry'

const DEVICE_ID_MAX = 128
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_\-:.]+$/

export const deviceTelemetryBodySchema = z.object({
  domain: z.enum(
    REALTIME_DATA_DOMAINS as [RealtimeDataDomain, ...RealtimeDataDomain[]],
  ),
  deviceId: z.string().min(1).max(DEVICE_ID_MAX).regex(DEVICE_ID_REGEX),
  ts: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
})

export type DeviceTelemetryBody = z.infer<typeof deviceTelemetryBodySchema>

export interface DeviceTelemetryServerContext {
  userAgent?: string
  ipCountry?: string
  ipRegion?: string
  requestId?: string
}

export function telemetryDocId(
  userId: string,
  deviceId: string,
  domain: RealtimeDataDomain,
): string {
  return `${userId}_${deviceId}_${domain}`
}

export function extractTelemetryServerContext(
  request: NextRequest,
): DeviceTelemetryServerContext {
  const headers = request.headers
  return {
    userAgent: headers.get('user-agent') ?? undefined,
    ipCountry:
      headers.get('cf-ipcountry') ??
      headers.get('x-vercel-ip-country') ??
      headers.get('x-country-code') ??
      undefined,
    ipRegion:
      headers.get('cf-region') ??
      headers.get('x-vercel-ip-country-region') ??
      undefined,
    requestId: headers.get('x-request-id') ?? undefined,
  }
}

function mergeTelemetryPayload(
  body: DeviceTelemetryBody,
  userId: string,
  server: DeviceTelemetryServerContext,
): Record<string, unknown> {
  const ts = body.ts ?? Date.now()
  const clientPayload = body.payload ?? {}

  return {
    userId,
    deviceId: body.deviceId,
    domain: body.domain,
    ts,
    payload: clientPayload,
    deviceLabel:
      typeof clientPayload.deviceLabel === 'string'
        ? clientPayload.deviceLabel
        : undefined,
    screen:
      clientPayload.screen && typeof clientPayload.screen === 'object'
        ? clientPayload.screen
        : undefined,
    geo:
      clientPayload.geo && typeof clientPayload.geo === 'object'
        ? clientPayload.geo
        : undefined,
    locale:
      typeof clientPayload.locale === 'string' ? clientPayload.locale : undefined,
    timezone:
      typeof clientPayload.timezone === 'string'
        ? clientPayload.timezone
        : undefined,
    connectionType:
      typeof clientPayload.connectionType === 'string'
        ? clientPayload.connectionType
        : undefined,
    visibility:
      typeof clientPayload.visibility === 'string'
        ? clientPayload.visibility
        : undefined,
    server: {
      userAgent: server.userAgent,
      ipCountry: server.ipCountry,
      ipRegion: server.ipRegion,
      requestId: server.requestId,
      recordedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }
}

/**
 * Upsert last-known reading (efficient: one row per user+device+domain, not append-only).
 */
export async function upsertUserDeviceTelemetry(
  userId: string,
  body: DeviceTelemetryBody,
  serverContext: DeviceTelemetryServerContext = {},
): Promise<{ success: boolean; skipped: boolean; docId: string }> {
  if (isAnalyticsStorageDisabled()) {
    return {
      success: true,
      skipped: true,
      docId: telemetryDocId(userId, body.deviceId, body.domain),
    }
  }

  const docId = telemetryDocId(userId, body.deviceId, body.domain)
  const row = mergeTelemetryPayload(body, userId, serverContext)

  const existing = await db().readDoc(USER_DEVICE_TELEMETRY, docId)
  if (existing.success && existing.data) {
    const updated = await db().updateDoc(USER_DEVICE_TELEMETRY, docId, row)
    return { success: updated.success, skipped: false, docId }
  }

  const created = await db().createDoc(USER_DEVICE_TELEMETRY, { id: docId, ...row })
  return { success: created.success, skipped: false, docId }
}

export async function getUserDeviceTelemetrySnapshots(
  userId: string,
  options?: { domain?: RealtimeDataDomain; limit?: number },
): Promise<Record<string, unknown>[]> {
  const filters = [{ field: 'userId', operator: '==' as const, value: userId }]
  if (options?.domain) {
    filters.push({ field: 'domain', operator: '==', value: options.domain })
  }

  const result = await db().queryDocs({
    collection: USER_DEVICE_TELEMETRY,
    filters,
    orderBy: [{ field: 'updated_at', direction: 'desc' }],
    pagination: { limit: options?.limit ?? 50 },
  })

  return result.success ? result.data : []
}

export interface SharedDeviceFingerprint {
  deviceId: string
  userIds: string[]
  userCount: number
}

/**
 * Find device fingerprints shared across multiple user accounts (fraud signal).
 * Scans recent telemetry rows in-memory (MVP; bounded by limit).
 */
export async function findSharedDeviceFingerprints(options?: {
  scanLimit?: number
}): Promise<SharedDeviceFingerprint[]> {
  const scanLimit = options?.scanLimit ?? 5000
  const result = await db().queryDocs<Record<string, unknown>>({
    collection: USER_DEVICE_TELEMETRY,
    orderBy: [{ field: 'updated_at', direction: 'desc' }],
    pagination: { limit: scanLimit },
  })

  if (!result.success || !result.data?.length) {
    return []
  }

  const byDevice = new Map<string, Set<string>>()
  for (const row of result.data) {
    const deviceId = String(row.deviceId ?? '')
    const userId = String(row.userId ?? '')
    if (!deviceId || !userId) continue
    if (!byDevice.has(deviceId)) {
      byDevice.set(deviceId, new Set())
    }
    byDevice.get(deviceId)!.add(userId)
  }

  const collisions: SharedDeviceFingerprint[] = []
  for (const [deviceId, userIds] of byDevice) {
    if (userIds.size > 1) {
      collisions.push({
        deviceId,
        userIds: [...userIds],
        userCount: userIds.size,
      })
    }
  }

  return collisions.sort((a, b) => b.userCount - a.userCount)
}

export async function getDistinctDeviceIdsForUser(
  userId: string,
  options?: { sinceMs?: number },
): Promise<string[]> {
  const snapshots = await getUserDeviceTelemetrySnapshots(userId, { limit: 100 })
  const since = options?.sinceMs ?? 0
  const ids = new Set<string>()
  for (const row of snapshots) {
    const deviceId = String(row.deviceId ?? '')
    const updated = String(row.updated_at ?? row.ts ?? '')
    if (!deviceId) continue
    if (since > 0 && updated) {
      const t = Date.parse(updated)
      if (!Number.isNaN(t) && t < since) continue
    }
    ids.add(deviceId)
  }
  return [...ids]
}
