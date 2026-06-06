"use client"

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { OpportunitySubmenuCounts, OpportunitySubmenuTab } from '@/features/opportunities/types'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Bookmark, 
  Send, 
  Edit3, 
  Clock, 
  Globe
} from 'lucide-react'

interface OpportunitiesSubmenuProps {
  activeTab: OpportunitySubmenuTab
  onTabChange: (tab: OpportunitySubmenuTab) => void
  counts?: OpportunitySubmenuCounts
}

interface TabConfig {
  id: OpportunitySubmenuTab
  label: string
  icon: typeof FileText
  count: number
  color: 'default' | 'secondary' | 'outline' | 'destructive'
  isAvailable: boolean
}

const OpportunitiesSubmenu = ({ 
  activeTab, 
  onTabChange, 
  counts = { all: 0, saved: 0, applied: 0, posted: 0, drafts: 0, expired: 0 }
}: OpportunitiesSubmenuProps) => {
  const t = useTranslations('modules.opportunities')

  const tabs: TabConfig[] = [
    {
      id: 'all',
      label: t('allOpportunities'),
      icon: Globe,
      count: counts.all,
      color: 'default',
      isAvailable: true
    },
    {
      id: 'saved', 
      label: t('savedOpportunities'),
      icon: Bookmark,
      count: counts.saved,
      color: 'secondary',
      isAvailable: false
    },
    {
      id: 'applied',
      label: t('appliedOpportunities'), 
      icon: Send,
      count: counts.applied,
      color: 'default',
      isAvailable: false
    },
    {
      id: 'posted',
      label: t('postedOpportunities'),
      icon: FileText, 
      count: counts.posted,
      color: 'default',
      isAvailable: true
    },
    {
      id: 'drafts',
      label: t('draftOpportunities'),
      icon: Edit3,
      count: counts.drafts,
      color: 'outline',
      isAvailable: false
    },
    {
      id: 'expired',
      label: t('expiredOpportunities'),
      icon: Clock,
      count: counts.expired, 
      color: 'destructive',
      isAvailable: true
    }
  ]

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <nav className="flex space-x-1 overflow-x-auto scrollbar-hide py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            const commonProps = {
              role: 'tab',
              'aria-selected': isActive,
              'aria-disabled': !tab.isAvailable,
            } as const

            return (
              <button
                key={tab.id}
                {...commonProps}
                onClick={() => {
                  if (!tab.isAvailable) return
                  onTabChange(tab.id)
                }}
                disabled={!tab.isAvailable}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                  "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : cn(
                        "text-muted-foreground hover:text-foreground", 
                        !tab.isAvailable && "opacity-50 cursor-not-allowed"
                      )
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <Badge 
                    variant={isActive ? "secondary" : tab.color}
                    className={cn(
                      "ml-1 h-5 px-1.5 text-xs",
                      isActive && "bg-primary-foreground/20 text-primary-foreground"
                    )}
                  >
                    {tab.count}
                  </Badge>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default OpportunitiesSubmenu
