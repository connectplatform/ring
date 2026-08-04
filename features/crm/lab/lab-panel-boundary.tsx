'use client'

import { ErrorBoundary } from '@/components/error-boundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Isolate Order Lab panels so one render throw cannot Oops the whole CRM order page. */
export function LabPanelBoundary({
  label,
  children,
  onError,
}: {
  label: string
  children: React.ReactNode
  /** When set, a panel crash can flip the parent tab chip to red. */
  onError?: (error: Error) => void
}) {
  return (
    <ErrorBoundary
      onError={(error) => onError?.(error)}
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              This panel failed to render. Other sections remain available — refresh to retry.
            </p>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
