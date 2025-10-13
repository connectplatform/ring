'use client'

import React from 'react'
import { CheckCircle2 } from 'lucide-react'

export interface StepsProps {
  children: React.ReactNode
}

export interface StepProps {
  children: React.ReactNode
}

export function Steps({ children }: StepsProps) {
  const steps = React.Children.toArray(children)
  
  return (
    <div className="my-8 space-y-6">
      {steps.map((step, index) => (
        <div key={index} className="relative flex gap-4">
          {/* Step number/indicator */}
          <div className="flex flex-col items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-primary/10 font-semibold text-primary">
              {index + 1}
            </div>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="mt-2 h-full w-0.5 bg-border" />
            )}
          </div>
          
          {/* Step content */}
          <div className="flex-1 pb-8">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {step}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Step({ children }: StepProps) {
  return <div className="step-content">{children}</div>
}

