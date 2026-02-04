'use client'

import { useState, useEffect } from 'react'
import { useGasPrice, useEstimateGas, useChainId } from 'wagmi'
import { mainnet, polygon, arbitrum, optimism, base } from 'wagmi/chains'
import { formatGwei, parseEther } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Zap, TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'

interface GasData {
  chainId: number
  chainName: string
  gasPrice: string
  estimatedFee: string
  color: string
  icon: string
  congestion: 'low' | 'medium' | 'high'
}

const CHAIN_CONFIG = [
  { chain: mainnet, color: 'bg-blue-500', icon: '⟠' },
  { chain: polygon, color: 'bg-purple-500', icon: '⬡' },
  { chain: arbitrum, color: 'bg-cyan-500', icon: '⚡' },
  { chain: optimism, color: 'bg-red-500', icon: '🔴' },
  { chain: base, color: 'bg-green-500', icon: '💚' },
]

export function GasOptimization() {
  const currentChainId = useChainId()
  const [gasData, setGasData] = useState<GasData[]>([])
  const [selectedChain, setSelectedChain] = useState<number>(currentChainId)

  // Fetch gas prices for all chains
  useEffect(() => {
    const fetchGasData = async () => {
      const gasPromises = CHAIN_CONFIG.map(async ({ chain, color, icon }) => {
        try {
          // This would normally use wagmi hooks, but for demo we'll simulate
          const gasPrice = await getGasPriceForChain(chain.id)
          const estimatedFee = calculateEstimatedFee(gasPrice, chain.id)

          return {
            chainId: chain.id,
            chainName: chain.name,
            gasPrice: formatGwei(gasPrice),
            estimatedFee,
            color,
            icon,
            congestion: getCongestionLevel(gasPrice, chain.id),
          }
        } catch (error) {
          console.error(`Failed to fetch gas for ${chain.name}:`, error)
          return {
            chainId: chain.id,
            chainName: chain.name,
            gasPrice: '0',
            estimatedFee: '0',
            color,
            icon,
            congestion: 'low' as const,
          }
        }
      })

      const results = await Promise.all(gasPromises)
      setGasData(results)
    }

    fetchGasData()

    // Refresh every 30 seconds
    const interval = setInterval(fetchGasData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Get the best chain for gas efficiency
  const bestChain = gasData.reduce((best, current) => {
    if (!best || parseFloat(current.estimatedFee) < parseFloat(best.estimatedFee)) {
      return current
    }
    return best
  }, null as GasData | null)

  const currentChainData = gasData.find(chain => chain.chainId === currentChainId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Gas Optimization Dashboard
          </CardTitle>
          <p className="text-muted-foreground">
            Compare gas prices across chains and optimize your transactions
          </p>
        </CardHeader>
      </Card>

      {/* Best Chain Recommendation */}
      {bestChain && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${bestChain.color} rounded-full flex items-center justify-center text-white font-bold`}>
                {bestChain.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  💡 Switch to {bestChain.chainName} for Lowest Fees
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  Save ~${(parseFloat(currentChainData?.estimatedFee || '0') - parseFloat(bestChain.estimatedFee)).toFixed(2)}
                  on average transactions
                </p>
              </div>
              <Button
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-100"
                onClick={() => setSelectedChain(bestChain.chainId)}
              >
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gas Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gasData.map((chain) => (
          <Card
            key={chain.chainId}
            className={`cursor-pointer transition-all ${
              selectedChain === chain.chainId
                ? 'ring-2 ring-primary'
                : 'hover:shadow-md'
            }`}
            onClick={() => setSelectedChain(chain.chainId)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${chain.color} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                    {chain.icon}
                  </div>
                  <CardTitle className="text-base">{chain.chainName}</CardTitle>
                </div>
                <Badge
                  variant={
                    chain.congestion === 'low' ? 'default' :
                    chain.congestion === 'medium' ? 'secondary' : 'destructive'
                  }
                >
                  {chain.congestion}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gas Price</span>
                    <span className="font-medium">{chain.gasPrice} Gwei</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Est. Fee</span>
                    <span className="font-medium">${chain.estimatedFee}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Network Load</span>
                    <div className="flex items-center gap-1">
                      {chain.congestion === 'low' && <TrendingDown className="h-3 w-3 text-green-500" />}
                      {chain.congestion === 'medium' && <Clock className="h-3 w-3 text-yellow-500" />}
                      {chain.congestion === 'high' && <TrendingUp className="h-3 w-3 text-red-500" />}
                    </div>
                  </div>
                  <Progress
                    value={
                      chain.congestion === 'low' ? 25 :
                      chain.congestion === 'medium' ? 60 : 90
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Optimization Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Gas Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Timing Matters</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Transact during off-peak hours (2-6 AM UTC)</li>
                <li>• Avoid major news events and token launches</li>
                <li>• Use Layer 2 networks for lower fees</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Batch Transactions</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Combine multiple actions into one transaction</li>
                <li>• Use smart contracts for complex operations</li>
                <li>• Consider gasless transactions for better UX</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper functions
async function getGasPriceForChain(chainId: number): Promise<bigint> {
  // Simulate gas price fetching - in real app, use RPC calls
  const basePrices = {
    1: 20000000000n,    // 20 gwei (Ethereum)
    137: 50000000000n,  // 50 gwei (Polygon)
    42161: 100000000n,  // 0.1 gwei (Arbitrum)
    10: 100000000n,     // 0.1 gwei (Optimism)
    8453: 100000000n,   // 0.1 gwei (Base)
  }

  // Add some randomness to simulate real network conditions
  const basePrice = basePrices[chainId as keyof typeof basePrices] || 10000000000n
  const variance = Math.random() * 0.5 + 0.75 // 75-125% of base price
  return BigInt(Math.floor(Number(basePrice) * variance))
}

function calculateEstimatedFee(gasPrice: bigint, chainId: number): string {
  // Estimate fee for a typical transfer (21000 gas)
  const gasLimit = 21000n
  const feeWei = gasPrice * gasLimit

  // Convert to ETH and then estimate USD value
  const feeEth = Number(feeWei) / 1e18
  const ethPrice = 2500 // Simplified ETH price
  const feeUsd = feeEth * ethPrice

  return feeUsd.toFixed(2)
}

function getCongestionLevel(gasPrice: bigint, chainId: number): 'low' | 'medium' | 'high' {
  const gasPriceGwei = Number(gasPrice) / 1e9

  // Chain-specific thresholds
  const thresholds = {
    1: { low: 20, medium: 50 },      // Ethereum
    137: { low: 30, medium: 100 },   // Polygon
    42161: { low: 0.5, medium: 2 },  // Arbitrum
    10: { low: 0.5, medium: 2 },     // Optimism
    8453: { low: 0.5, medium: 2 },   // Base
  }

  const chainThresholds = thresholds[chainId as keyof typeof thresholds] || { low: 10, medium: 30 }

  if (gasPriceGwei <= chainThresholds.low) return 'low'
  if (gasPriceGwei <= chainThresholds.medium) return 'medium'
  return 'high'
}
