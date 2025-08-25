"use client"

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
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
  activeTab: string
  onTabChange: (tab: string) => void
  counts?: {
    all: number
    saved: number
    applied: number
    posted: number
    drafts: number
    expired: number
  }
}

const OpportunitiesSubmenu = ({ 
  activeTab, 
  onTabChange, 
  counts = { all: 0, saved: 0, applied: 0, posted: 0, drafts: 0, expired: 0 }
}: OpportunitiesSubmenuProps) => {
  const t = useTranslations('modules.opportunities')

  const tabs = [
    {
      id: 'all',
      label: t('allOpportunities'),
      icon: Globe,
      count: counts.all,
      color: 'default'
    },
    {
      id: 'saved', 
      label: t('savedOpportunities'),
      icon: Bookmark,
      count: counts.saved,
      color: 'secondary'
    },
    {
      id: 'applied',
      label: t('appliedOpportunities'), 
      icon: Send,
      count: counts.applied,
      color: 'default'
    },
    {
      id: 'posted',
      label: t('postedOpportunities'),
      icon: FileText, 
      count: counts.posted,
      color: 'default'
    },
    {
      id: 'drafts',
      label: t('draftOpportunities'),
      icon: Edit3,
      count: counts.drafts,
      color: 'outline'
    },
    {
      id: 'expired',
      label: t('expiredOpportunities'),
      icon: Clock,
      count: counts.expired, 
      color: 'destructive'
    }
  ]

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <nav className="flex space-x-1 overflow-x-auto scrollbar-hide py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
                  "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <Badge 
                    variant={isActive ? "secondary" : tab.color as any}
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
