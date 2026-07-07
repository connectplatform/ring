'use client'

import React, { useState, useEffect } from 'react'
import { Monitor, Smartphone, Globe, Clock, Wifi, Eye, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { davinciGlassSurface, davinciPanelSurface } from '@/lib/ui/davinci'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ForensicsEntry {
  deviceId: string
  deviceLabel?: string
  browser?: string
  browserVersion?: string
  os?: string
  screenWidth?: number
  screenHeight?: number
  colorDepth?: number
  ipCountry?: string
  ipRegion?: string
  connectionType?: string
  timezone?: string
  locale?: string
  firstSeenAt?: string
  lastSeenAt?: string
}

interface SessionForensicsWidgetProps {
  entries: ForensicsEntry[]
  loading?: boolean
  lastLogin?: string
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function getDeviceIcon(os?: string, deviceLabel?: string) {
  if (deviceLabel?.toLowerCase().includes('mobile') || os === 'iOS' || os === 'Android')
    return Smartphone
  return Monitor
}

export function SessionForensicsWidget({ entries, loading, lastLogin }: SessionForensicsWidgetProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <Card className={cn(davinciGlassSurface, 'animate-pulse')}>
        <CardContent className="p-6 space-y-3">
          <div className="h-4 bg-muted/30 rounded w-3/4" />
          <div className="h-3 bg-muted/20 rounded w-1/2" />
          <div className="h-3 bg-muted/20 rounded w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!entries.length) {
    return (
      <Card className={cn(davinciGlassSurface)}>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground text-center">
            No device session data available. Forensics appear after your next login.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const DeviceIcon = getDeviceIcon(entry.os, entry.deviceLabel)
        const isExpanded = expandedId === entry.deviceId

        return (
          <Card
            key={entry.deviceId}
            className={cn(
              davinciPanelSurface,
              'border border-primary/[0.06] hover:border-primary/15',
              'transition-all duration-200'
            )}
          >
            <CardContent className="p-0">
              {/* Main row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : entry.deviceId)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                    'bg-primary/10 border border-primary/20'
                  )}>
                    <DeviceIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {entry.os || entry.browser || 'Unknown Device'}
                      {entry.browser && entry.browserVersion && (
                        <span className="text-muted-foreground font-normal ml-1">
                          · {entry.browser} {entry.browserVersion}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {entry.ipCountry && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[entry.ipCountry, entry.ipRegion].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {entry.lastSeenAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last seen: {formatDate(entry.lastSeenAt)}
                        </span>
                      )}
                      {lastLogin && !entry.lastSeenAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last seen: {lastLogin}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    active
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded forensics detail */}
              {isExpanded && (
                <div className="border-t border-primary/[0.06] px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {/* Browser */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Browser
                      </span>
                      <p className="font-medium mt-0.5">
                        {entry.browser ? `${entry.browser} ${entry.browserVersion || ''}`.trim() : '—'}
                      </p>
                    </div>
                    {/* OS */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Monitor className="w-3 h-3" /> OS
                      </span>
                      <p className="font-medium mt-0.5">{entry.os || '—'}</p>
                    </div>
                    {/* Screen */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Screen
                      </span>
                      <p className="font-medium mt-0.5">
                        {entry.screenWidth && entry.screenHeight
                          ? `${entry.screenWidth}×${entry.screenHeight}`
                          : '—'}
                      </p>
                    </div>
                    {/* Connection */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> Connection
                      </span>
                      <p className="font-medium mt-0.5">{entry.connectionType || '—'}</p>
                    </div>
                    {/* First Seen */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> First Login
                      </span>
                      <p className="font-medium mt-0.5">{formatDate(entry.firstSeenAt)}</p>
                    </div>
                    {/* Timezone */}
                    <div>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Timezone
                      </span>
                      <p className="font-medium mt-0.5">{entry.timezone || '—'}</p>
                    </div>
                    {/* Locale */}
                    <div>
                      <span className="text-muted-foreground">Locale</span>
                      <p className="font-medium mt-0.5">{entry.locale || '—'}</p>
                    </div>
                    {/* Device ID */}
                    <div>
                      <span className="text-muted-foreground">Device ID</span>
                      <p className="font-medium mt-0.5 font-mono text-[10px] truncate">{entry.deviceId.slice(0, 12)}…</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
