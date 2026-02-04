'use client'

/**
 * Staking Card Component
 * 
 * Simplified staking interface for DAGI agent activation
 * Integrates with APRStaking contract on Polygon
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, CheckCircle2 } from 'lucide-react'

interface StakingCardProps {
  tokenSymbol: string
  requiredStake: number
  onStakeComplete: (amount: number) => void
  loading?: boolean
  disabled?: boolean
  comingSoon?: boolean
}

export function StakingCard({
  tokenSymbol,
  requiredStake,
  onStakeComplete,
  loading = false,
  disabled = false,
  comingSoon = false
}: StakingCardProps) {
  const [stakeAmount, setStakeAmount] = useState(requiredStake.toString())
  const [balance, setBalance] = useState<number | null>(null)
  const [isStaking, setIsStaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // TODO: Fetch user's DAARION balance from wallet
    // For now, mock balance
    setBalance(1000)
  }, [])

  async function handleStake() {
    try {
      setIsStaking(true)
      setError(null)

      const amount = Number(stakeAmount)
      
      // Validation
      if (isNaN(amount) || amount < requiredStake) {
        setError(`Minimum stake: ${requiredStake} ${tokenSymbol}`)
        return
      }

      if (balance !== null && amount > balance) {
        setError(`Insufficient balance. You have ${balance} ${tokenSymbol}`)
        return
      }

      // TODO: Integrate with APRStaking contract
      // 1. Connect wallet (MetaMask/WalletConnect)
      // 2. Approve DAARION spend
      // 3. Call APRStaking.stakeDAARION(amount)
      // 4. Wait for transaction confirmation
      
      // Mock success
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setSuccess(true)
      onStakeComplete(amount)
    } catch (err) {
      console.error('Staking error:', err)
      setError(err instanceof Error ? err.message : 'Failed to stake tokens')
    } finally {
      setIsStaking(false)
    }
  }

  if (comingSoon) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
        <p className="text-muted-foreground">
          This tier will be available in Q4 2025
        </p>
        <Button disabled className="mt-4">
          Coming Soon
        </Button>
      </div>
    )
  }

  if (success) {
    return (
      <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900 dark:text-green-100">
          Successfully staked {stakeAmount} {tokenSymbol}! Your DAGI agent is being provisioned...
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="stake-amount">Stake Amount ({tokenSymbol})</Label>
        <div className="relative">
          <Input
            id="stake-amount"
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder={`Min: ${requiredStake}`}
            min={requiredStake}
            disabled={disabled || loading || isStaking}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-7 text-xs"
            onClick={() => setStakeAmount(balance?.toString() || requiredStake.toString())}
            disabled={disabled || loading || isStaking}
          >
            MAX
          </Button>
        </div>
        {balance !== null && (
          <p className="text-xs text-muted-foreground">
            Balance: {balance} {tokenSymbol}
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleStake}
        disabled={disabled || loading || isStaking}
        className="w-full"
        size="lg"
      >
        {(isStaking || loading) ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Staking...
          </>
        ) : (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            Stake & Activate Agent
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By staking, you agree to DAGI Terms of Service. Your stake earns 4% APR in DAAR rewards.
      </p>
    </div>
  )
}

