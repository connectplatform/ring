'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MultiChainBalance } from './multi-chain-balance'
import { WalletConnectButton } from './wallet-connect-button'
import { Network, Wallet, Zap, Globe, ArrowRightLeft } from 'lucide-react'

const SUPPORTED_CHAINS = [
  { chain: mainnet, icon: '⟠', color: 'bg-blue-500' },
  { chain: polygon, icon: '⬡', color: 'bg-purple-500' },
  { chain: arbitrum, icon: '⚡', color: 'bg-cyan-500' },
  { chain: optimism, icon: '🔴', color: 'bg-red-500' },
  { chain: base, icon: '💚', color: 'bg-green-500' },
]

export function MultiChainWalletDashboard() {
  const { address, isConnected, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const currentChainId = useChainId()

  const [activeTab, setActiveTab] = useState('overview')

  if (!isConnected) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Multi-Chain Wallet Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <div className="mb-6">
            <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Access multi-chain DeFi across Ethereum, Polygon, Arbitrum, Optimism, and Base
            </p>
          </div>

          <div className="flex justify-center">
            <WalletConnectButton />
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            {SUPPORTED_CHAINS.map(({ chain: chainInfo, icon, color }) => (
              <div key={chainInfo.id} className="text-center">
                <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold`}>
                  {icon}
                </div>
                <div className="text-sm font-medium">{chainInfo.name}</div>
                <div className="text-xs text-muted-foreground">{chainInfo.nativeCurrency.symbol}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-6 w-6" />
                Multi-Chain Wallet Dashboard
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                Manage your assets across 5 major blockchain networks
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Current Chain Indicator */}
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                <Badge variant="outline" className="flex items-center gap-1">
                  {SUPPORTED_CHAINS.find(c => c.chain.id === currentChainId)?.icon}
                  {chain?.name || 'Unknown'}
                </Badge>
              </div>

              {/* RainbowKit Connect Button */}
              <ConnectButton.Custom>
                {({ account, chain: rainbowChain, openAccountModal, openChainModal }) => (
                  <Button
                    variant="outline"
                    onClick={openAccountModal}
                    className="flex items-center gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {account?.displayName}
                  </Button>
                )}
              </ConnectButton.Custom>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Chain Switcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Switch Networks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {SUPPORTED_CHAINS.map(({ chain: chainInfo, icon, color }) => (
              <Button
                key={chainInfo.id}
                variant={currentChainId === chainInfo.id ? "default" : "outline"}
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => switchChain({ chainId: chainInfo.id })}
              >
                <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                  {icon}
                </div>
                <div className="text-center">
                  <div className="font-medium text-sm">{chainInfo.name}</div>
                  <div className="text-xs opacity-75">{chainInfo.nativeCurrency.symbol}</div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="defi">DeFi</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <MultiChainBalance />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Gas Optimization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">85% Saved</div>
                <p className="text-sm text-muted-foreground">
                  Average gas fee reduction across all chains
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Chains Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5</div>
                <p className="text-sm text-muted-foreground">
                  Major networks supported
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Protocols
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">50+</div>
                <p className="text-sm text-muted-foreground">
                  DeFi protocols accessible
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Detailed balance view coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Transaction history across all chains coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defi">
          <Card>
            <CardHeader>
              <CardTitle>DeFi Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Cross-Chain Yield</h4>
                  <p className="text-sm text-muted-foreground">
                    Compare yields across protocols on different chains
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Liquidity Mining</h4>
                  <p className="text-sm text-muted-foreground">
                    Provide liquidity and earn rewards across chains
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Arbitrage Opportunities</h4>
                  <p className="text-sm text-muted-foreground">
                    Exploit price differences between DEXs
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Bridge Assets</h4>
                  <p className="text-sm text-muted-foreground">
                    Move assets between chains securely
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
