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
      className: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200',
      iconClassName: 'text-blue-500',
      defaultTitle: 'Info',
    },
    warning: {
      icon: AlertTriangle,
      className: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200',
      iconClassName: 'text-yellow-500',
      defaultTitle: 'Warning',
    },
    error: {
      icon: AlertCircle,
      className: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200',
      iconClassName: 'text-red-500',
      defaultTitle: 'Error',
    },
    success: {
      icon: CheckCircle,
      className: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200',
      iconClassName: 'text-green-500',
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
        <div className="text-sm leading-relaxed [&>p]:mb-0">
          {children}
        </div>
      </div>
    </div>
  )
}

