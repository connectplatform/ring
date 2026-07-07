'use client'

/**
 * MESSAGES WRAPPER - Ring Platform v2.0
 * ========================================
 * Consolidated to RingRightRailLayout.
 * Tips sidebar becomes the rightRail prop.
 *
 * Note: The `locale` prop remains optional (`string | undefined`) because the
 * messenger stack does not consistently pass a typed Locale at every callsite.
 * Consumers should cast as Locale when using locale-sensitive features.
 */

import React from 'react'
import RingRightRailLayout from '@/components/layout/ring-right-rail-layout'
import { DavinciCenterPane } from '@/components/layout/davinci-center-pane'
import { MessageCircle, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MessagesWrapperProps {
  children: React.ReactNode
  locale?: string
}

/**
 * Tips sidebar content for the messenger page.
 * Shown as right rail on desktop, via FloatingSidebarToggle on mobile/tablet.
 */
function MessagesTipsRail() {
  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 text-sm text-muted-foreground space-y-2">
          <p>Enter to send; Shift+Enter for a new line. Attachments upload to your conversation folder.</p>
          <p>Typing and new messages use your existing API plus tunnel push for sub-second updates.</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 text-sm text-muted-foreground">
          <p>Messages sync over Ring Tunnel; REST APIs remain the source of truth.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MessagesWrapper({ children }: MessagesWrapperProps) {
  return (
    <RingRightRailLayout
      rightRailPurpose="messenger"
      rightRailContent={[
        { blockType: 'messenger-tips', i18nKey: 'messenger.tips' },
        { blockType: 'messenger-security', i18nKey: 'messenger.security' },
      ]}
      rightRail={<MessagesTipsRail />}
      railWidth={300}
      contentClassName="pb-24 lg:pb-8"
      flushCenterPane
    >
      <DavinciCenterPane>
        {children}
      </DavinciCenterPane>
    </RingRightRailLayout>
  )
}
