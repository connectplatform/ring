'use client'

import React from 'react'
import { AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react'

export interface CalloutProps {
  children: React.ReactNode
  type?: 'info' | 'warning' | 'error' | 'success'
  title?: string
}

export function Callout({ children, type = 'info', title }: CalloutProps) {
  const config = {
    info: {
      icon: Info,
      className: 'border-info bg-info/10 text-info-foreground',
      iconClassName: 'text-info',
      defaultTitle: 'Info',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-warning bg-warning/10 text-warning-foreground',
      iconClassName: 'text-warning',
      defaultTitle: 'Warning',
    },
    error: {
      icon: AlertCircle,
      className: 'border-destructive bg-destructive/10 text-destructive-foreground',
      iconClassName: 'text-destructive',
      defaultTitle: 'Error',
    },
    success: {
      icon: CheckCircle,
      className: 'border-success bg-success/10 text-success-foreground',
      iconClassName: 'text-success',
      defaultTitle: 'Success',
    },
  }

  const { icon: Icon, className, iconClassName, defaultTitle } = config[type]

  return (
    <div className={`my-6 flex gap-3 rounded-lg border-l-4 p-4 ${className}`}>
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconClassName}`} />
      <div className="flex-1">
        {title && (
          <div className="mb-1 font-semibold">{title}</div>
        )}
        <div className="text-sm leading-relaxed [&>p]:mb-0 [&>ul]:my-3 [&>ul]:ml-4 [&>ul]:list-disc [&>ul]:space-y-1 [&>ul>li]:text-sm [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80">
          {children}
        </div>
      </div>
    </div>
  )
}

