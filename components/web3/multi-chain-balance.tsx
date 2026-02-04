'use client'

import { useState, useEffect } from 'react'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { formatEther } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Globe, TrendingUp } from 'lucide-react'

interface ChainBalance {
  chainId: number
  chainName: string
  symbol: string
  balance: string
  formattedBalance: string
  usdValue?: string
  color: string
}

const SUPPORTED_CHAINS = [
  { chain: mainnet, color: 'bg-blue-500' },
  { chain: polygon, color: 'bg-purple-500' },
  { chain: arbitrum, color: 'bg-cyan-500' },
  { chain: optimism, color: 'bg-red-500' },
  { chain: base, color: 'bg-green-500' },
]

export function MultiChainBalance() {
  const { address, isConnected } = useAccount()
  const currentChainId = useChainId()
  const [totalBalance, setTotalBalance] = useState('0')
  const [chainBalances, setChainBalances] = useState<ChainBalance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch balances for all supported chains
  useEffect(() => {
    if (!address || !isConnected) {
      setChainBalances([])
      setTotalBalance('0')
      setIsLoading(false)
      return
    }

    const fetchAllBalances = async () => {
      setIsLoading(true)

      try {
        const balances: ChainBalance[] = []

        // Fetch balance for each chain
        for (const { chain, color } of SUPPORTED_CHAINS) {
          try {
            // Use wagmi's useBalance hook pattern, but we need to fetch manually
            const balanceResponse = await fetch('/api/balance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                address,
                chainId: chain.id
              })
            })

            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              const formattedBalance = balanceData.balance || '0'

              balances.push({
                chainId: chain.id,
                chainName: chain.name,
                symbol: chain.nativeCurrency.symbol,
                balance: formattedBalance,
                formattedBalance: parseFloat(formattedBalance).toFixed(4),
                color,
              })
            } else {
              // Add zero balance for chains we can't fetch
              balances.push({
                chainId: chain.id,
                chainName: chain.name,
                symbol: chain.nativeCurrency.symbol,
                balance: '0',
                formattedBalance: '0.0000',
                color,
              })
            }
          } catch (error) {
            console.error(`Failed to fetch balance for ${chain.name}:`, error)
            balances.push({
              chainId: chain.id,
              chainName: chain.name,
              symbol: chain.nativeCurrency.symbol,
              balance: '0',
              formattedBalance: '0.0000',
              color,
            })
          }
        }

        setChainBalances(balances)

        // Calculate total balance (sum of all chains)
        const total = balances.reduce((sum, chainBalance) => {
          return sum + parseFloat(chainBalance.balance)
        }, 0)

        setTotalBalance(total.toFixed(4))

      } catch (error) {
        console.error('Failed to fetch multi-chain balances:', error)
        setChainBalances([])
        setTotalBalance('0')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllBalances()

    // Refresh every 30 seconds
    const interval = setInterval(fetchAllBalances, 30000)

    return () => clearInterval(interval)
  }, [address, isConnected])

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Multi-Chain Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect your wallet to view balances across all chains</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Multi-Chain Balance
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-2xl font-bold">{totalBalance} ETH</span>
          <Badge variant="secondary">Total Across All Chains</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chainBalances.map((chainBalance) => (
            <div
              key={chainBalance.chainId}
              className={`p-4 rounded-lg border ${
                chainBalance.chainId === currentChainId
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${chainBalance.color}`} />
                  <span className="font-medium">{chainBalance.chainName}</span>
                </div>
                {chainBalance.chainId === currentChainId && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
              </div>
              <div className="text-lg font-semibold">
                {chainBalance.formattedBalance} {chainBalance.symbol}
              </div>
              {chainBalance.balance !== '0' && (
                <div className="text-sm text-muted-foreground mt-1">
                  ${(parseFloat(chainBalance.balance) * 2500).toFixed(2)} USD
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Multi-Chain Benefits</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Access DeFi protocols across 5 major chains</li>
            <li>• Arbitrage opportunities between chains</li>
            <li>• Lower fees on Layer 2 networks</li>
            <li>• Future cross-chain transfers</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
