'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LabThread, EmbeddedConversation } from '@/features/crm/lab/order-lab-chat-rail'
import { fetchJsonSafe } from '@/features/crm/lab/safe-fetch-json'

/**
 * Admin CRM chat — three tabs: shared Project room | Integrator DM | Client DM.
 */
export function AdminCrmChatTabs({ orderId }: { orderId: string }) {
  const { data: session, status } = useSession()
  const [labId, setLabId] = useState<string | null>(null)
  const [integratorDmId, setIntegratorDmId] = useState<string | null>(null)
  const [clientDmId, setClientDmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      setBooting(true)
      try {
        const { ok, data, error: parseErr } = await fetchJsonSafe<{
          error?: string
          labConversationId?: string
          orderLabConversationId?: string
          integratorDmId?: string | null
          clientDmId?: string | null
          customerConversationId?: string | null
        }>(`/api/my-jobs/${orderId}/chat`)
        if (!ok || !data) throw new Error(parseErr || data?.error || 'Failed to open chats')
        if (data.error) throw new Error(data.error)
        if (!cancelled) {
          setLabId(data.labConversationId || data.orderLabConversationId || null)
          setIntegratorDmId(data.integratorDmId || null)
          setClientDmId(data.clientDmId || data.customerConversationId || null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chat failed')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const userId = session?.user?.id

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Project chats</CardTitle>
      </CardHeader>
      <CardContent className="h-[480px] p-0">
        {status === 'loading' || booting ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : !userId ? null : (
          <Tabs className="flex h-full min-h-0 flex-col" defaultValue="room">
            <TabsList className="mx-3 mt-2 grid w-auto grid-cols-3">
              <TabsTrigger value="room">Reggie room</TabsTrigger>
              <TabsTrigger value="integrator">Integrator</TabsTrigger>
              <TabsTrigger value="client">Client</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden" value="room">
              {labId ? (
                <EmbeddedConversation conversationId={labId} userId={userId} variant="order_lab" />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">Project room unavailable</p>
              )}
            </TabsContent>
            <TabsContent
              className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
              value="integrator"
            >
              {integratorDmId ? (
                <LabThread conversationId={integratorDmId} userId={userId} />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  Assign an integrator to open a private DM.
                </p>
              )}
            </TabsContent>
            <TabsContent className="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden" value="client">
              {clientDmId ? (
                <LabThread conversationId={clientDmId} userId={userId} />
              ) : (
                <p className="p-4 text-sm text-muted-foreground">Client DM unavailable</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
