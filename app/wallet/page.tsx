'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Wallet,
  TrendingUp,
  ArrowDownUp,
  Send,
  Receipt,
  Gift,
  Shield,
  Zap,
  DollarSign,
  Coins,
  PiggyBank,
  Target,
  Users,
  Building,
  Smartphone,
  Globe
} from 'lucide-react'

interface TokenBalance {
  symbol: string
  name: string
  balance: number
  usdValue: number
  change24h: number
  icon: React.ComponentType<any>
}

interface Transaction {
  id: string
  type: 'send' | 'receive' | 'purchase' | 'staking' | 'reward'
  amount: number
  token: string
  to: string
  from: string
  timestamp: string
  status: 'completed' | 'pending' | 'failed'
  description: string
}

const mockBalances: TokenBalance[] = [
  {
    symbol: 'JWT',
    name: 'JWT Utility Token',
    balance: 1250.50,
    usdValue: 1250.50,
    change24h: 2.5,
    icon: DollarSign
  },
  {
    symbol: 'RING',
    name: 'RING Governance Token',
    balance: 250.75,
    usdValue: 5000.00,
    change24h: -1.2,
    icon: Coins
  }
]

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'receive',
    amount: 50,
    token: 'JWT',
    to: 'Your Wallet',
    from: 'Service Payment',
    timestamp: '2025-01-15T10:30:00Z',
    status: 'completed',
    description: 'Payment for Ring platform customization'
  },
  {
    id: '2',
    type: 'send',
    amount: 25,
    token: 'RING',
    to: 'Staking Pool',
    from: 'Your Wallet',
    timestamp: '2025-01-14T15:45:00Z',
    status: 'completed',
    description: 'Staking for governance rewards'
  },
  {
    id: '3',
    type: 'reward',
    amount: 10,
    token: 'JWT',
    to: 'Your Wallet',
    from: 'Ring Platform',
    timestamp: '2025-01-13T09:00:00Z',
    status: 'completed',
    description: 'Weekly activity reward'
  },
  {
    id: '4',
    type: 'purchase',
    amount: 100,
    token: 'JWT',
    to: 'Your Wallet',
    from: 'Exchange',
    timestamp: '2025-01-12T14:20:00Z',
    status: 'completed',
    description: 'Token purchase'
  }
]

const tokenFeatures = {
  jwt: [
    {
      icon: ArrowDownUp,
      title: 'P2P Transfers',
      description: 'Send and receive tokens instantly between users'
    },
    {
      icon: Receipt,
      title: 'Service Payments',
      description: 'Pay for goods and services within the ecosystem'
    },
    {
      icon: Gift,
      title: 'Activity Rewards',
      description: 'Earn tokens through platform engagement'
    },
    {
      icon: PiggyBank,
      title: 'Savings',
      description: 'Build wealth through platform participation'
    }
  ],
  ring: [
    {
      icon: Shield,
      title: 'Governance',
      description: 'Vote on platform decisions and proposals'
    },
    {
      icon: Target,
      title: 'Staking Rewards',
      description: 'Earn rewards by staking your tokens'
    },
    {
      icon: Building,
      title: 'Premium Access',
      description: 'Access exclusive features and services'
    },
    {
      icon: Users,
      title: 'Community Benefits',
      description: 'Special perks for token holders'
    }
  ]
}

export default function DualTokenEcosystemPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedToken, setSelectedToken] = useState<'JWT' | 'RING'>('JWT')

  const totalBalance = mockBalances.reduce((sum, balance) => sum + balance.usdValue, 0)

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'send': return <Send className="w-4 h-4 text-red-500" />
      case 'receive': return <Receipt className="w-4 h-4 text-green-500" />
      case 'purchase': return <DollarSign className="w-4 h-4 text-blue-500" />
      case 'staking': return <PiggyBank className="w-4 h-4 text-purple-500" />
      case 'reward': return <Gift className="w-4 h-4 text-yellow-500" />
      default: return <Wallet className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'pending': return 'text-yellow-600'
      case 'failed': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-0 py-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold">Dual-Token Ecosystem</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Manage JWT utility tokens for p2p transfers and RING tokens for premium features and governance.
          </p>
        </div>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Portfolio Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">${totalBalance.toFixed(2)}</div>
              <div className="text-sm text-gray-500 mb-4">Total Portfolio Value</div>

              <div className="space-y-4">
                {mockBalances.map((balance) => {
                  const Icon = balance.icon
                  const percentage = (balance.usdValue / totalBalance) * 100

                  return (
                    <div key={balance.symbol} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <Icon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold">{balance.symbol}</div>
                          <div className="text-sm text-gray-500">{balance.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{balance.balance.toFixed(2)} {balance.symbol}</div>
                        <div className="text-sm text-gray-500">${balance.usdValue.toFixed(2)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Send Tokens
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Receipt className="w-4 h-4 mr-2" />
                Receive Tokens
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <PiggyBank className="w-4 h-4 mr-2" />
                Stake RING
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <DollarSign className="w-4 h-4 mr-2" />
                Buy Tokens
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="staking">Staking</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Token Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>JWT Utility Token</CardTitle>
                      <CardDescription>Utility token for p2p transfers, goods, and services</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{mockBalances[0].balance.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Your Balance</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${mockBalances[0].usdValue.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">USD Value</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tokenFeatures.jwt.map((feature, index) => {
                      const Icon = feature.icon
                      return (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                            <Icon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{feature.title}</div>
                            <div className="text-xs text-gray-500">{feature.description}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <Coins className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>RING Governance Token</CardTitle>
                      <CardDescription>Premium token for governance and exclusive features</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{mockBalances[1].balance.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">Your Balance</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">${mockBalances[1].usdValue.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">USD Value</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {tokenFeatures.ring.map((feature, index) => {
                      const Icon = feature.icon
                      return (
                        <div key={index} className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                            <Icon className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{feature.title}</div>
                            <div className="text-xs text-gray-500">{feature.description}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent token transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="font-semibold">{transaction.description}</div>
                          <div className="text-sm text-gray-500">
                            {transaction.type === 'send' ? `To: ${transaction.to}` : `From: ${transaction.from}`}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(transaction.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${transaction.type === 'send' ? 'text-red-600' : 'text-green-600'}`}>
                          {transaction.type === 'send' ? '-' : '+'}{transaction.amount} {transaction.token}
                        </div>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staking" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Staking</CardTitle>
                  <CardDescription>Monitor your RING token staking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 mb-2">25 RING</div>
                  <div className="text-sm text-gray-500 mb-4">Currently Staked</div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Staking Period</span>
                      <span className="font-semibold">30 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>APY</span>
                      <span className="font-semibold text-green-600">12.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Rewards</span>
                      <span className="font-semibold">0.625 RING</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Progress value={75} className="mb-2" />
                    <div className="text-sm text-gray-500">22 days remaining</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Staking Pools</CardTitle>
                  <CardDescription>Available staking opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold">Governance Pool</div>
                          <div className="text-sm text-gray-500">Vote on platform decisions</div>
                        </div>
                        <Badge className="bg-purple-100 text-purple-800">12.5% APY</Badge>
                      </div>
                      <Button size="sm" className="w-full mt-2">Stake in Pool</Button>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold">Liquidity Pool</div>
                          <div className="text-sm text-gray-500">Provide liquidity for rewards</div>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">15.2% APY</Badge>
                      </div>
                      <Button size="sm" className="w-full mt-2">Stake in Pool</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Governance Dashboard</CardTitle>
                <CardDescription>Participate in Ring platform governance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">25</div>
                    <div className="text-sm text-gray-500">Your Voting Power</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">3</div>
                    <div className="text-sm text-gray-500">Active Proposals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">89%</div>
                    <div className="text-sm text-gray-500">Participation Rate</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold">Platform Fee Adjustment</div>
                        <div className="text-sm text-gray-500">Proposal to reduce platform fees by 0.5%</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Voting ends in 5 days</span>
                      <span>67% Yes / 33% No</span>
                    </div>
                    <Progress value={67} className="mb-3" />
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1">Vote Yes</Button>
                      <Button size="sm" variant="outline" className="flex-1">Vote No</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
