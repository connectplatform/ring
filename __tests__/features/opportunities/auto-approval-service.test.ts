// @ts-nocheck
import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals'

jest.mock('server-only', () => ({}))

const mockGetResolvedAIConfig = jest.fn()
const mockIsLLMAvailableAsync = jest.fn()
const mockGetMatcherInstallDefaults = jest.fn()
const mockDbExecute = jest.fn()
const mockAppendEvent = jest.fn()
const mockSyncOpportunityDiscovery = jest.fn()
const mockCreateNotification = jest.fn()

jest.mock('@/features/admin/platform-settings/resolved-ai-config', () => ({
  getResolvedAIConfig: (...args: unknown[]) => mockGetResolvedAIConfig(...args),
}))

jest.mock('@/lib/ai/llm-client', () => ({
  isLLMAvailableAsync: (...args: unknown[]) => mockIsLLMAvailableAsync(...args),
}))

jest.mock('@/lib/ring-config-core', () => ({
  getMatcherInstallDefaults: (...args: unknown[]) => mockGetMatcherInstallDefaults(...args),
}))

jest.mock('@/lib/database/DatabaseService', () => ({
  db: () => ({
    execute: (...args: unknown[]) => mockDbExecute(...args),
  }),
}))

jest.mock('@/lib/events/event-log.server', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}))

jest.mock('@/features/opportunities/lib/opportunity-mutation-sync', () => ({
  syncOpportunityDiscovery: (...args: unknown[]) => mockSyncOpportunityDiscovery(...args),
}))

jest.mock('@/features/notifications/services/notification-service', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

jest.mock('@/features/notifications/types', () => ({
  NotificationType: { OPPORTUNITY_UPDATED: 'opportunity_updated' },
  NotificationChannel: { IN_APP: 'in_app', PUSH: 'push' },
  NotificationPriority: { HIGH: 'high' },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const baseOpportunity = {
  id: 'opp-1',
  status: 'pending',
  createdBy: 'user-1',
  title: 'Test',
} as const

function makeMatchingResult(overrides: Record<string, unknown> = {}) {
  return {
    opportunityId: 'opp-1',
    matches: [
      {
        userId: 'match-1',
        overallScore: 85,
        confidence: 0.8,
        explanation: 'Strong fit',
        matchFactors: {},
      },
    ],
    totalCandidates: 1,
    processingTime: 10,
    matchQuality: {
      averageScore: 85,
      highQualityMatches: 1,
      mediumQualityMatches: 0,
      lowQualityMatches: 0,
    },
    ...overrides,
  }
}

describe('maybeAutoApproveOpportunity', () => {
  let maybeAutoApproveOpportunity: typeof import('@/features/opportunities/services/auto-approval-service').maybeAutoApproveOpportunity

  beforeAll(async () => {
    ;({ maybeAutoApproveOpportunity } = await import(
      '@/features/opportunities/services/auto-approval-service'
    ))
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMatcherInstallDefaults.mockReturnValue({ llmConfidenceGate: 0.8 })
    mockGetResolvedAIConfig.mockResolvedValue({
      matcher: {
        autoApprove: true,
        autoApproveMinScore: 0.7,
        scoreThreshold: 0.7,
        maxMatches: 10,
      },
    })
    mockIsLLMAvailableAsync.mockResolvedValue(true)
    mockDbExecute.mockResolvedValue({ success: true })
    mockAppendEvent.mockResolvedValue('event-1')
    mockCreateNotification.mockResolvedValue(undefined)
  })

  it('returns not approved when toggle is off', async () => {
    mockGetResolvedAIConfig.mockResolvedValue({
      matcher: { autoApprove: false, autoApproveMinScore: 0.7 },
    })

    const result = await maybeAutoApproveOpportunity(
      baseOpportunity as never,
      makeMatchingResult() as never,
    )

    expect(result.approved).toBe(false)
    expect(result.reason).toBe('auto_approve_disabled')
    expect(mockDbExecute).not.toHaveBeenCalled()
  })

  it('returns not approved when status is not pending', async () => {
    const result = await maybeAutoApproveOpportunity(
      { ...baseOpportunity, status: 'draft' } as never,
      makeMatchingResult() as never,
    )

    expect(result.approved).toBe(false)
    expect(result.reason).toBe('not_pending')
  })

  it('returns not approved when LLM is unavailable', async () => {
    mockIsLLMAvailableAsync.mockResolvedValue(false)

    const result = await maybeAutoApproveOpportunity(
      baseOpportunity as never,
      makeMatchingResult() as never,
    )

    expect(result.approved).toBe(false)
    expect(result.reason).toBe('llm_unavailable')
  })

  it('returns not approved when best confidence is fallback (0.5)', async () => {
    const result = await maybeAutoApproveOpportunity(
      baseOpportunity as never,
      makeMatchingResult({
        matches: [{ userId: 'm1', overallScore: 90, confidence: 0.5, matchFactors: {} }],
      }) as never,
    )

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('llm_not_used_for_run')
  })

  it('returns not approved when scores are below threshold', async () => {
    const result = await maybeAutoApproveOpportunity(
      baseOpportunity as never,
      makeMatchingResult({
        matches: [{ userId: 'm1', overallScore: 50, confidence: 0.8, matchFactors: {} }],
      }) as never,
    )

    expect(result.approved).toBe(false)
    expect(result.reason).toContain('no_matches_above_threshold')
  })

  it('approves pending opportunity on happy path', async () => {
    const result = await maybeAutoApproveOpportunity(
      baseOpportunity as never,
      makeMatchingResult() as never,
    )

    expect(result.approved).toBe(true)
    expect(result.reason).toBe('approved')
    expect(mockDbExecute).toHaveBeenCalledWith(
      'update',
      expect.objectContaining({
        collection: 'opportunities',
        id: 'opp-1',
        data: expect.objectContaining({ status: 'active' }),
      }),
    )
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'opportunity_auto_approved' }),
    )
    expect(mockSyncOpportunityDiscovery).toHaveBeenCalled()
    expect(mockCreateNotification).toHaveBeenCalled()
  })
})
