'use client'

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, CreditCard, User } from 'lucide-react'
import type { AuthUser } from '@/features/auth/types'
import { cn } from '@/lib/utils'

type AdminPaymentRow = {
  id: string
  purpose: string
  processor: string
  rail: string
  orderReference: string
  status: string
  amountMinor?: number
  currency?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface AdminUserDetailSheetProps {
  user: AuthUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatAmount(amountMinor?: number, currency?: string) {
  if (typeof amountMinor !== 'number') return '—'
  const amount = (amountMinor / 100).toFixed(2)
  return `${amount} ${currency || ''}`.trim()
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  try {
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    return d.toLocaleString()
  } catch {
    return String(value)
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'paid':
      return 'border-green-600 text-green-700'
    case 'failed':
    case 'cancelled':
      return 'border-red-600 text-red-700'
    case 'redirected':
    case 'pending':
      return 'border-amber-600 text-amber-700'
    default:
      return ''
  }
}

function purposeLabel(purpose: string) {
  if (purpose === 'membership_upgrade') return 'Membership'
  if (purpose === 'wallet_topup') return 'Credit top-up'
  return purpose
}

export function AdminUserDetailSheet({
  user,
  open,
  onOpenChange,
}: AdminUserDetailSheetProps) {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !user?.id) {
      setPayments([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch(`/api/admin/users/${user.id}/payments?limit=50`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load payments')
        if (!cancelled) {
          setPayments(data.payments ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payments')
          setPayments([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, user?.id])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {user?.name || user?.email || 'User'}
          </SheetTitle>
          <SheetDescription>{user?.email}</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="payments" className="mt-4 flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs">{user?.id}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="outline">{user?.role}</Badge>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Verified</span>
              <span>{user?.isVerified ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(user?.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last login</span>
              <span>{formatDate(user?.lastLogin)}</span>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Membership upgrades and credit top-ups from the payment_transactions ledger
              (PaymentConductor).
            </p>

            {loading && (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {!loading && !error && payments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No membership or credit top-up payments yet.
              </p>
            )}

            {!loading && payments.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(p.paidAt || p.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">{purposeLabel(p.purpose)}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {p.processor} · {p.orderReference.slice(0, 24)}…
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatAmount(p.amountMinor, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] capitalize', statusBadgeClass(p.status))}
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
