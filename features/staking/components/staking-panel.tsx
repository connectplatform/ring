import React, { useMemo, useRef, useState } from 'react'
import type { StakingPosition } from '../types'
import { formatAPR } from '../../evm/utils'

interface Props {
  positions: StakingPosition[]
  onStakeDaar: (amount: string) => Promise<void>
  onStakeDaarion: (amount: string) => Promise<void>
  onUnstakeDaar: (amount: string) => Promise<void>
  onUnstakeDaarion: (amount: string) => Promise<void>
  onClaimDaar: () => Promise<void>
  onClaimDaarion: () => Promise<void>
}

export const StakingPanel: React.FC<Props> = ({
  positions,
  onStakeDaar,
  onStakeDaarion,
  onUnstakeDaar,
  onUnstakeDaarion,
  onClaimDaar,
  onClaimDaarion
}) => {
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const isValidAmount = (value: string) => {
    if (!value) return false
    const n = Number(value)
    return Number.isFinite(n) && n > 0
  }

  const setAmountDebounced = (value: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => setAmount(value), 200)
  }
  const posDaar = useMemo(() => positions.find(p => p.token === 'DAAR'), [positions])
  const posDaarion = useMemo(() => positions.find(p => p.token === 'DAARION'), [positions])

  return (
    <div className="staking-panel">
      <section>
        <h3>DAAR Staking</h3>
        <div>Staked: {posDaar?.stakedAmount || '0'}</div>
        <div>Pending rewards: {posDaar?.pendingRewards || '0'}</div>
        {typeof posDaar?.apr === 'number' && <div>APR: {formatAPR(posDaar!.apr!)}</div>}
        <div>
          <input
            placeholder="Amount"
            defaultValue={amount}
            onChange={(e) => setAmountDebounced(e.target.value)}
          />
        </div>
        <div>
          <button
            disabled={!isValidAmount(amount) || isSubmitting}
            onClick={async () => {
              if (!isValidAmount(amount) || isSubmitting) return
              setIsSubmitting(true)
              try { await onStakeDaar(amount) } finally { setIsSubmitting(false) }
            }}
          >Stake DAAR</button>
          <button
            disabled={!isValidAmount(amount) || isSubmitting}
            onClick={async () => {
              if (!isValidAmount(amount) || isSubmitting) return
              setIsSubmitting(true)
              try { await onUnstakeDaar(amount) } finally { setIsSubmitting(false) }
            }}
          >Unstake DAAR</button>
          <button
            disabled={isSubmitting}
            onClick={async () => { if (isSubmitting) return; setIsSubmitting(true); try { await onClaimDaar() } finally { setIsSubmitting(false) } }}
          >Claim Rewards</button>
        </div>
      </section>
      <section>
        <h3>DAARION Staking</h3>
        <div>Staked: {posDaarion?.stakedAmount || '0'}</div>
        <div>Pending rewards: {posDaarion?.pendingRewards || '0'}</div>
        {typeof posDaarion?.apr === 'number' && <div>APR: {formatAPR(posDaarion!.apr!)}</div>}
        <div>
          <input
            placeholder="Amount"
            defaultValue={amount}
            onChange={(e) => setAmountDebounced(e.target.value)}
          />
        </div>
        <div>
          <button
            disabled={!isValidAmount(amount) || isSubmitting}
            onClick={async () => { if (!isValidAmount(amount) || isSubmitting) return; setIsSubmitting(true); try { await onStakeDaarion(amount) } finally { setIsSubmitting(false) } }}
          >Stake DAARION</button>
          <button
            disabled={!isValidAmount(amount) || isSubmitting}
            onClick={async () => { if (!isValidAmount(amount) || isSubmitting) return; setIsSubmitting(true); try { await onUnstakeDaarion(amount) } finally { setIsSubmitting(false) } }}
          >Unstake DAARION</button>
          <button
            disabled={isSubmitting}
            onClick={async () => { if (isSubmitting) return; setIsSubmitting(true); try { await onClaimDaarion() } finally { setIsSubmitting(false) } }}
          >Claim Rewards</button>
        </div>
      </section>
    </div>
  )
}

export default StakingPanel


