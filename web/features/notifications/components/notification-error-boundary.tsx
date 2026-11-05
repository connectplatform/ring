'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import { davinciGlassSurface } from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

function NotificationErrorFallback({
  message,
  retryCount,
  onRetry,
  stack,
  componentStack,
}: {
  message: string
  retryCount: number
  onRetry: () => void
  stack?: string
  componentStack?: string | null
}) {
  const t = useTranslations('modules.notifications.preferences.errorBoundary')
  const locale = useLocale() as Locale
  const exhausted = retryCount >= 3

  return (
    <div className={cn(davinciGlassSurface, 'p-4')}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-lg font-semibold text-foreground">{t('title')}</h3>
          <p className="mb-4 text-muted-foreground">{message || t('fallback')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onRetry} disabled={exhausted} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              {exhausted ? t('maxRetries') : t('retry')}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={ROUTES.NOTIFICATIONS_SETTINGS(locale)}>
                <Settings className="mr-2 h-4 w-4" />
                {t('settings')}
              </Link>
            </Button>
          </div>
          {retryCount > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('retryCount', { count: retryCount })}</p>
          ) : null}
          {process.env.NODE_ENV === 'development' && (stack || componentStack) ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium">{t('details')}</summary>
              <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                {stack}
                {componentStack ? `\n\n${componentStack}` : ''}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export class NotificationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    this.props.onError?.(error, errorInfo)
    console.error('Notification Error:', error, errorInfo)
  }

  handleRetry = () => {
    if (this.state.retryCount >= 3) return
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <NotificationErrorFallback
          message={this.state.error?.message ?? ''}
          retryCount={this.state.retryCount}
          onRetry={this.handleRetry}
          stack={this.state.error?.stack}
          componentStack={this.state.errorInfo?.componentStack}
        />
      )
    }

    return this.props.children
  }
}
