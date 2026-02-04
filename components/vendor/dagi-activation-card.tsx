'use client'

/**
 * DAGI Activation Card
 * 
 * Displays DAGI agent status and activation interface with DAARION staking
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bot, Zap, TrendingUp, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { StakingCard } from '@/components/vendor/staking-card'

interface DAGIActivationCardProps {
  userId: string
}

interface AgentStatus {
  hasAgent: boolean
  agentId?: string
  tier?: 1 | 2 | 3
  status?: 'provisioning' | 'active' | 'suspended'
  stakedAmount?: number
  capabilities?: string[]
}

export function DAGIActivationCard({ userId }: DAGIActivationCardProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ hasAgent: false })
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    fetchAgentStatus()
  }, [userId])

  async function fetchAgentStatus() {
    try {
      setLoading(true)
      // TODO: Implement API call to check agent status
      // const response = await fetch('/api/vendor/dagi-agent/status')
      // const data = await response.json()
      
      // Mock data for now
      setAgentStatus({
        hasAgent: false,
        // hasAgent: true,
        // agentId: 'dagi-vendor-123',
        // tier: 2,
        // status: 'active',
        // stakedAmount: 500,
        // capabilities: ['VOICE_INTERFACE', 'HARVEST_SCHEDULING', 'DYNAMIC_PRICING']
      })
    } catch (error) {
      console.error('Failed to fetch agent status:', error)
    } finally {
      setLoading(false)
    }
  }

  async function activateAgent(tier: 1 | 2 | 3, stakedAmount: number) {
    try {
      setActivating(true)
      
      // TODO: Implement agent provisioning
      // 1. Verify DAARION stake
      // 2. Call ring-platform.org/api/v1/agents/provision
      // 3. Update local database
      // 4. Show success message
      
      console.log(`Activating DAGI Tier ${tier} with ${stakedAmount} DAARION stake`)
      
      // Mock success
      setTimeout(() => {
        setAgentStatus({
          hasAgent: true,
          agentId: `dagi-${userId}-${Date.now()}`,
          tier,
          status: 'provisioning',
          stakedAmount,
        })
        setActivating(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to activate agent:', error)
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (agentStatus.hasAgent) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-green-900 dark:text-green-100">
                  DAGI Agent Active
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Your AI farm assistant is operational
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-green-500 hover:bg-green-600">
              {agentStatus.status === 'active' ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Provisioning
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Agent Tier</p>
                <p className="text-2xl font-bold">
                  {agentStatus.tier === 1 && 'Junior'}
                  {agentStatus.tier === 2 && 'Medium'}
                  {agentStatus.tier === 3 && 'Senior DAGI-7B'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">DAARION Staked</p>
                <p className="text-2xl font-bold">{agentStatus.stakedAmount}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Agent ID</p>
              <code className="text-xs bg-white dark:bg-gray-900 p-2 rounded block">
                {agentStatus.agentId}
              </code>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="w-full">
                View Dashboard
              </Button>
              <Button variant="outline" className="w-full">
                Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Activate DAGI AI Agent</CardTitle>
            <CardDescription>
              Get 24/7 customer service and farm management automation
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tier1" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tier1">Junior</TabsTrigger>
            <TabsTrigger value="tier2">Medium</TabsTrigger>
            <TabsTrigger value="tier3">Senior</TabsTrigger>
          </TabsList>

          <TabsContent value="tier1" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Tier 1: Junior DAGI</span>
                <Badge>1GB Model</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Perfect for small farms. Basic chat, order tracking, and inventory alerts.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">100</span>
                <span className="text-sm text-muted-foreground">DAARION stake required</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✅ Text chat interface</li>
                <li>✅ Basic customer support</li>
                <li>✅ Order status tracking</li>
                <li>✅ Simple inventory alerts</li>
              </ul>
            </div>

            <StakingCard
              tokenSymbol="DAARION"
              requiredStake={100}
              onStakeComplete={(amount) => activateAgent(1, amount)}
              loading={activating}
            />
          </TabsContent>

          <TabsContent value="tier2" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Tier 2: Medium DAGI</span>
                <Badge className="bg-blue-500">2-3GB Model</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                For growing farms. Voice interface, harvest scheduling, and dynamic pricing.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">500</span>
                <span className="text-sm text-muted-foreground">DAARION stake required</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✅ All Tier 1 features</li>
                <li>✅ Voice interface support</li>
                <li>✅ Harvest scheduling</li>
                <li>✅ Dynamic price optimization</li>
                <li>✅ Sales forecasting</li>
              </ul>
            </div>

            <StakingCard
              tokenSymbol="DAARION"
              requiredStake={500}
              onStakeComplete={(amount) => activateAgent(2, amount)}
              loading={activating}
            />
          </TabsContent>

          <TabsContent value="tier3" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Tier 3: Senior DAGI-7B</span>
                <Badge className="bg-purple-500">5-6GB Model</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                For large operations. AI vision, IoT integration, and predictive analytics.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">2,000</span>
                <span className="text-sm text-muted-foreground">DAARION stake required</span>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>✅ All Tier 2 features</li>
                <li>✅ Crop yield prediction</li>
                <li>✅ Pest & disease detection</li>
                <li>✅ IoT sensor integration</li>
                <li>✅ Computer vision</li>
                <li>✅ FSMA 204 automation</li>
              </ul>
              <Badge variant="outline" className="mt-2">
                Available Q4 2025
              </Badge>
            </div>

            <StakingCard
              tokenSymbol="DAARION"
              requiredStake={2000}
              onStakeComplete={(amount) => activateAgent(3, amount)}
              loading={activating}
              disabled={true}
              comingSoon={true}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg flex gap-3">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <strong>How it works:</strong> Stake DAARION tokens to activate your AI agent. 
            Your stake earns 4% APR in DAAR rewards while your agent works 24/7 managing 
            customer service and farm operations.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

