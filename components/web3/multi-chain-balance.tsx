// TODO: Reuse code if needed.

// 'use client'

// import { useState, useEffect } from 'react'
// import { useConnection, useBalance, useChainId } from 'wagmi'
// import { getNativeChainConfig } from '@/lib/ring-config-chain'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
// import { Loader2, Globe, TrendingUp } from 'lucide-react'
// import { SupportedChains } from '@/lib/ring-config-chain'

// interface ChainBalance {
//   chainId: number
//   chainName: string
//   symbol: string
//   balance: string
//   formattedBalance: string
//   usdValue?: string
//   color: string
// }

// // TODO: Upgrade memoization of SUPPORTED_CHAINS using useMemo() to avoid recalculation on every render
// //       when getNativeChainConfig is stable. Consider hoisting chain config logic up and passing as prop for SSR.
// //       If targeting React 19, consider use() for async config retrieval if/when available.
// const SUPPORTED_CHAINS: { chain: SupportedChains; chainId: number; color: string }[] = Array.isArray(getNativeChainConfig().enabled)
//   ? getNativeChainConfig().enabled.map((chain) => ({
//       chain,
//       // ChainId mapping is currently static; ideally, this should come from config.
//       chainId: chain === 'solana' ? 101 : chain === 'evm' ? 137 : chain === 'base' ? 10 : 0, // STUB: Use dynamic lookup from config; TODO: Refactor to config-driven
//       color:
//         chain === 'solana'
//           ? 'bg-yellow-500'
//           : chain === 'evm'
//           ? 'bg-purple-500'
//           : chain === 'base'
//           ? 'bg-red-500'
//           : 'bg-blue-500', // fallback color for unknown chains
//     }))
//   : [] // Fallback to empty array if config missing or malformed

// export function MultiChainBalance() {
//   // Get wallet address and status from wagmi hook
//   const { address, isConnected } = useConnection()
//   // Get current connected chain id
//   const currentChainId = useChainId()
//   // Local state for balances
//   const [totalBalance, setTotalBalance] = useState('0')
//   const [chainBalances, setChainBalances] = useState<ChainBalance[]>([])
//   const [isLoading, setIsLoading] = useState(true)

//   // Fetch balances for all supported chains on mount and when connection changes
//   useEffect(() => {
//     if (!address || !isConnected) {
//       // Clear state if not connected
//       setChainBalances([])
//       setTotalBalance('0')
//       setIsLoading(false)
//       return
//     }

//     // STUB: Replace with use( ... ) + async server actions when available, for React/Next 19 hydration optimizations

//     // Main async fetch function
//     const fetchAllBalances = async () => {
//       setIsLoading(true)

//       try {
//         const balances: ChainBalance[] = []

//         // Loop through each supported chain and fetch user's balance
//         for (const { chain, chainId, color } of SUPPORTED_CHAINS) {
//           try {
//             // STUB: Current implementation calls unified endpoint '/api/balance'
//             // TODO: Use React19 use() resource if endpoint is async server action
//             const balanceResponse = await fetch('/api/balance', {
//               method: 'POST',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({
//                 address,
//                 chainId: chain // STUB: Unclear if chain or chainId is needed -- align API
//               })
//             })

//             if (balanceResponse.ok) {
//               const balanceData = await balanceResponse.json()
//               // Use returned balance or 0 as fallback
//               const formattedBalance = balanceData.balance || '0'
//               // Format for display and push to array
//               balances.push({
//                 chainId: chainId,
//                 chainName: chain,
//                 // Symbol mapping for display
//                 symbol:
//                   chain === 'solana'
//                     ? 'SOL'
//                     : chain === 'evm'
//                     ? 'ETH'
//                     : chain === 'base'
//                     ? 'BASE'
//                     : 'UNKNOWN',
//                 balance: formattedBalance,
//                 formattedBalance: parseFloat(formattedBalance).toFixed(4),
//                 color: color,
//               })
//             } else {
//               // If API fails, push empty/zero for fallback display
//               balances.push({
//                 chainId: chainId,
//                 chainName: chain,
//                 symbol:
//                   chain === 'solana'
//                     ? 'SOL'
//                     : chain === 'evm'
//                     ? 'ETH'
//                     : chain === 'base'
//                     ? 'BASE'
//                     : 'UNKNOWN',
//                 balance: '0',
//                 formattedBalance: '0.0000',
//                 color: color,
//               })
//             }
//           } catch (error) {
//             // If fetch fails, log error and push zero
//             console.error(`Failed to fetch balance for ${chain}:`, error)
//             balances.push({
//               chainId: chainId,
//               chainName: chain,
//               symbol:
//                 chain === 'solana'
//                   ? 'SOL'
//                   : chain === 'evm'
//                   ? 'ETH'
//                   : chain === 'base'
//                   ? 'BASE'
//                   : 'UNKNOWN',
//               balance: '0',
//               formattedBalance: '0.0000',
//               color: color,
//             })
//           }
//         }

//         // Save per-chain balances to state
//         setChainBalances(balances)

//         // Calculate and save total balance across all chains
//         // TODO: Support real USD conversion (balances[i].usdValue) as displayed value is currently a fake multiply
//         const total = balances.reduce((sum, chainBalance) => {
//           return sum + parseFloat(chainBalance.balance)
//         }, 0)

//         setTotalBalance(total.toFixed(4))
//       } catch (error) {
//         // Log, reset as fallback
//         console.error('Failed to fetch multi-chain balances:', error)
//         setChainBalances([])
//         setTotalBalance('0')
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     // Initial fetch after connect
//     fetchAllBalances()

//     // Set up periodic refresh (30s) while mounted
//     // TODO: Use native useEffect event streaming (React 19), or use useInterval or Suspense if beneficial
//     const interval = setInterval(fetchAllBalances, 30000)

//     // Cleanup on unmount to avoid memory leaks
//     return () => clearInterval(interval)
//   }, [address, isConnected])

//   // If not connected, display connect prompt card
//   if (!isConnected) {
//     return (
//       <Card className="w-full">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <Globe className="h-5 w-5" />
//             Multi-Chain Balance
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <p className="text-muted-foreground">Connect your wallet to view balances across all chains</p>
//         </CardContent>
//       </Card>
//     )
//   }

//   // Connected: display balances
//   return (
//     <Card className="w-full">
//       <CardHeader>
//         <CardTitle className="flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <Globe className="h-5 w-5" />
//             Multi-Chain Balance
//           </div>
//           {/* Loader shown while fetching */}
//           {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
//         </CardTitle>
//         <div className="flex items-center gap-2">
//           <TrendingUp className="h-4 w-4 text-green-500" />
//           {/* TODO: Support multiple symbols. Now defaults to ETH for all. */}
//           <span className="text-2xl font-bold">{totalBalance} ETH</span>
//           <Badge variant="secondary">Total Across All Chains</Badge>
//         </div>
//       </CardHeader>
//       <CardContent>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           {chainBalances.map((chainBalance) => (
//             <div
//               key={chainBalance.chainId}
//               // Highlight active chain
//               className={`p-4 rounded-lg border ${
//                 chainBalance.chainId === currentChainId
//                   ? 'border-primary bg-primary/5'
//                   : 'border-border'
//               }`}
//             >
//               <div className="flex items-center justify-between mb-2">
//                 <div className="flex items-center gap-2">
//                   {/* Per-chain theme indicator */}
//                   <div className={`w-3 h-3 rounded-full ${chainBalance.color}`} />
//                   <span className="font-medium">{chainBalance.chainName}</span>
//                 </div>
//                 {/* Tag for currently active chain */}
//                 {chainBalance.chainId === currentChainId && (
//                   <Badge variant="default" className="text-xs">Active</Badge>
//                 )}
//               </div>
//               {/* Show balance and symbol */}
//               <div className="text-lg font-semibold">
//                 {chainBalance.formattedBalance} {chainBalance.symbol}
//               </div>
//               {/* Show USD approximation only if balance > 0 */}
//               {chainBalance.balance !== '0' && (
//                 <div className="text-sm text-muted-foreground mt-1">
//                   {/* STUB: USD price is fakely hardcoded (ETH = 2500), replace with real price lookup */}
//                   ${(parseFloat(chainBalance.balance) * 2500).toFixed(2)} USD
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>

//         {/* Info section */}
//         <div className="mt-6 p-4 bg-muted rounded-lg">
//           <h4 className="font-medium mb-2">Multi-Chain Benefits</h4>
//           <ul className="text-sm text-muted-foreground space-y-1">
//             <li>• Access DeFi protocols across 5 major chains</li>
//             <li>• Arbitrage opportunities between chains</li>
//             <li>• Lower fees on Layer 2 networks</li>
//             <li>• Future cross-chain transfers</li>
//           </ul>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }
