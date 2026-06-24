'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { DavinciGlassPanel } from '@/lib/ui/davinci'

type DeskQuote = {
  side: 'buy' | 'sell'
  ringAmountUi: string
  creditUsd: string
  creditFiatCurrency: string
  rate: string
  discountBps: number
  quoteToken: string
}

export default function DeskWidget() {
  const t = useTranslations('modules.wallet')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<DeskQuote | null>(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  const fetchQuote = useCallback(async () => {
    if (!amount.trim()) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ side, amount })
      const res = await fetch(`/api/wallet/desk/quote?${params}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Quote failed')
      }
      setQuote(data as DeskQuote)
    } catch (error) {
      toast({
        title: t('deskQuoteFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [amount, side, t])

  const executeQuote = useCallback(async () => {
    if (!quote) return
    setExecuting(true)
    try {
      const idempotencyKey = `desk_${quote.side}_${crypto.randomUUID()}`
      const res = await fetch('/api/wallet/desk/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, quoteToken: quote.quoteToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Execution failed')
      }
      toast({
        title: t('deskExecuteSuccess'),
        description:
          quote.side === 'buy'
            ? `${quote.ringAmountUi} RING`
            : `${quote.creditUsd} ${quote.creditFiatCurrency}`,
      })
      setQuote(null)
      setAmount('')
    } catch (error) {
      toast({
        title: t('deskExecuteFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setExecuting(false)
    }
  }, [quote, t])

  return (
    <DavinciGlassPanel
      title={t('deskTitle')}
      icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
      beamDuration="10s"
    >
      <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy">{t('deskBuy')}</TabsTrigger>
          <TabsTrigger value="sell">{t('deskSell')}</TabsTrigger>
        </TabsList>
        <TabsContent value="buy" className="space-y-3 pt-3">
          <Label htmlFor="desk-buy-amount">{t('deskBuyAmountLabel')}</Label>
          <Input
            id="desk-buy-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('deskBuyHint')}</p>
        </TabsContent>
        <TabsContent value="sell" className="space-y-3 pt-3">
          <Label htmlFor="desk-sell-amount">{t('deskSellAmountLabel')}</Label>
          <Input
            id="desk-sell-amount"
            type="number"
            min="0"
            step="0.00000001"
            placeholder="1.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('deskSellHint')}</p>
        </TabsContent>
      </Tabs>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" onClick={() => void fetchQuote()} disabled={loading || !amount}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deskGetQuote')}
        </Button>
        {quote && (
          <Button onClick={() => void executeQuote()} disabled={executing}>
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deskConfirm')}
          </Button>
        )}
      </div>

      {quote && (
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <p>
            {t('deskQuoteRing')}: <strong>{quote.ringAmountUi} RING</strong>
          </p>
          <p>
            {t('deskQuoteCredit')}:{' '}
            <strong>
              {quote.creditUsd} {quote.creditFiatCurrency}
            </strong>
          </p>
          {quote.discountBps > 0 && (
            <p className="text-emerald-600">{t('deskFirstSettlerDiscount')}</p>
          )}
        </div>
      )}
    </DavinciGlassPanel>
  )
}
