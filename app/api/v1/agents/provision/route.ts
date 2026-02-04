/**
 * DAGI Agent Provisioning API
 * 
 * Provisions DAARION Agricultural Intelligence (DAGI) agents for GreenFood.live vendors
 * 
 * Endpoint: POST /api/v1/agents/provision
 * Auth: API key from approved IPs only
 * 
 * @see /features/ai-agents/services/dagi-provisioning.ts (client-side)
 * @see /.cursor/legion/dagi-general-expert.json (agent specs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

// ============================================================================
// CONFIGURATION
// ============================================================================

const APPROVED_IPS = process.env.DAGI_APPROVED_IPS?.split(',') || [
  '127.0.0.1', // localhost
  '::1', // localhost IPv6
  // Add GreenFood.live production IPs here
]

const API_KEYS = process.env.DAGI_API_KEYS?.split(',') || []

const TIER_REQUIREMENTS = {
  1: { stake: 100, model: 'dagi-1.0', size: '1GB' },
  2: { stake: 500, model: 'dagi-2.0', size: '2-3GB' },
  3: { stake: 2000, model: 'dagi-7b-1.0', size: '5-6GB' },
}

// ============================================================================
// TYPES
// ============================================================================

interface ProvisionRequest {
  vendor_id: string
  farm_id: string
  tier: 1 | 2 | 3
  model_version: string
  model_size: string
  capabilities: string[]
  daarwizz_sync: boolean
  rag_data_sources: string[]
  stake_amount: number
  stake_token: 'DAARION'
  platform: 'greenfood.live'
  platform_api: string
}

interface ProvisionResponse {
  agent_id: string
  vendor_id: string
  farm_id: string
  tier: 1 | 2 | 3
  status: 'provisioning' | 'active' | 'failed'
  model_version: string
  capabilities: string[]
  daarion_citizen_id?: string
  api_key?: string
  webhook_url?: string
  provisioned_at: string
  message?: string
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION
// ============================================================================

async function authenticateRequest(req: NextRequest): Promise<{ authorized: boolean; error?: string }> {
  const headersList = headers()
  const authHeader = await headersList
  const authorization = authHeader.get('authorization')
  const apiKey = authorization?.replace('Bearer ', '')

  // Check API key
  if (!apiKey || !API_KEYS.includes(apiKey)) {
    return { authorized: false, error: 'Invalid or missing API key' }
  }

  // Check IP (if behind proxy, check X-Forwarded-For)
  const clientIP = 
    authHeader.get('x-forwarded-for')?.split(',')[0]?.trim() || 
    authHeader.get('x-real-ip') ||
    '127.0.0.1'

  if (!APPROVED_IPS.includes(clientIP) && process.env.NODE_ENV === 'production') {
    return { authorized: false, error: `IP ${clientIP} not approved for agent provisioning` }
  }

  return { authorized: true }
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateProvisionRequest(data: Partial<ProvisionRequest>): {
  valid: boolean
  error?: string
} {
  // Required fields
  if (!data.vendor_id) return { valid: false, error: 'vendor_id is required' }
  if (!data.farm_id) return { valid: false, error: 'farm_id is required' }
  if (!data.tier || ![1, 2, 3].includes(data.tier)) {
    return { valid: false, error: 'tier must be 1, 2, or 3' }
  }
  if (!data.stake_amount || typeof data.stake_amount !== 'number') {
    return { valid: false, error: 'stake_amount must be a number' }
  }
  if (data.stake_token !== 'DAARION') {
    return { valid: false, error: 'stake_token must be DAARION' }
  }

  // Validate stake amount meets tier requirement
  const requiredStake = TIER_REQUIREMENTS[data.tier].stake
  if (data.stake_amount < requiredStake) {
    return {
      valid: false,
      error: `Insufficient DAARION stake. Required: ${requiredStake} DAARION for Tier ${data.tier}, provided: ${data.stake_amount}`,
    }
  }

  return { valid: true }
}

// ============================================================================
// AGENT PROVISIONING LOGIC
// ============================================================================

async function provisionDAGIAgent(request: ProvisionRequest): Promise<ProvisionResponse> {
  // Generate unique agent ID
  const agentId = `dagi-${request.vendor_id}-${Date.now()}`

  // Generate API key for agent (in production, use secure key generation)
  const agentApiKey = process.env.NODE_ENV === 'production' 
    ? `dagi_${Buffer.from(`${agentId}-${Date.now()}`).toString('base64').substring(0, 32)}`
    : `dagi_dev_${agentId}`

  // Webhook URL for agent events
  const webhookUrl = `${request.platform_api}/agents/${agentId}/webhook`

  // In a real implementation, this would:
  // 1. Create agent record in database
  // 2. Initialize agent configuration
  // 3. Set up DAARWIZZ sync
  // 4. Configure RAG data sources
  // 5. Register as DAARION.city citizen
  // 6. Start agent services

  const tierConfig = TIER_REQUIREMENTS[request.tier]

  const response: ProvisionResponse = {
    agent_id: agentId,
    vendor_id: request.vendor_id,
    farm_id: request.farm_id,
    tier: request.tier,
    status: 'active', // In production: 'provisioning' → 'active' after setup
    model_version: tierConfig.model,
    capabilities: request.capabilities,
    daarion_citizen_id: `citizen-${agentId}`, // Placeholder - would come from DAARION.city
    api_key: agentApiKey,
    webhook_url: webhookUrl,
    provisioned_at: new Date().toISOString(),
    message: `DAGI Agent Tier ${request.tier} (${tierConfig.model}) provisioned successfully for ${request.vendor_id}`,
  }

  // TODO: In production implementation:
  // - Store agent configuration in database
  // - Initialize agent services
  // - Set up monitoring and logging
  // - Configure DAARWIZZ sync schedule
  // - Send notification to vendor

  return response
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate request
    const auth = await authenticateRequest(req)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body: Partial<ProvisionRequest> = await req.json()

    // 3. Validate request
    const validation = validateProvisionRequest(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // 4. Provision agent
    const result = await provisionDAGIAgent(body as ProvisionRequest)

    // 5. Return success response
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error provisioning DAGI agent:', error)
    return NextResponse.json(
      {
        error: 'Failed to provision DAGI agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET ENDPOINT - Agent Status Check
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(req)
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get agent_id from query params
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id query parameter required' },
        { status: 400 }
      )
    }

    // TODO: In production, query database for agent status
    // For now, return mock response
    return NextResponse.json({
      agent_id: agentId,
      status: 'active',
      uptime: '99.9%',
      last_sync: new Date().toISOString(),
      message: 'Agent operational',
    })
  } catch (error) {
    console.error('Error checking agent status:', error)
    return NextResponse.json(
      { error: 'Failed to check agent status' },
      { status: 500 }
    )
  }
}

