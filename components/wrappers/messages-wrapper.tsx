'use client'

import FloatingSidebarToggle from '@/components/common/floating-sidebar-toggle'
import { MessageCircle, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
interface MessagesWrapperProps {
  children: React.ReactNode
  locale?: string
}

/**
 * App shell for Ring Messenger: primary nav + full-height content region.
 * Real-time delivery uses Ring Tunnel (see MessagesContent + useMessages).
 */
export default function MessagesWrapper({ children }: MessagesWrapperProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="lg:hidden p-2 border-b flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <MessageCircle className="h-4 w-4" aria-hidden />
          Ring Messenger
        </span>
        <FloatingSidebarToggle>
          <div className="p-3 text-sm text-muted-foreground">Navigation and filters</div>
        </FloatingSidebarToggle>
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 flex min-w-0 min-h-0">
          <div className="w-full flex min-h-0">
            <div className="ring-content-panel w-full max-w-7xl mx-auto flex flex-col min-h-0 min-w-0 flex-1">
              {children}
              <div className="mt-2 hidden md:block text-xs text-muted-foreground text-center">
                <Shield className="inline h-3 w-3 mr-1 align-text-bottom" aria-hidden />
                Messages sync over Ring Tunnel; REST APIs remain the source of truth.
              </div>
            </div>
          </div>
          <aside className="hidden 2xl:block w-64 shrink-0 p-3 border-l bg-muted/20">
            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-sm">Tips</CardTitle>
              </CardHeader>
              <CardContent className="px-0 text-sm text-muted-foreground space-y-2">
                <p>Enter sends; Shift+Enter for a new line. Attachments upload to your conversation folder.</p>
                <p>Typing and new messages use your existing API plus tunnel push for sub-second updates.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
