'use client'

import React from 'react'

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
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-primary/10 font-semibold text-primary text-sm shrink-0">
              {index + 1}
            </div>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="mt-2 h-full w-0.5 bg-border" />
            )}
          </div>
          
          {/* Step content - MDXRemote handles all styling, no prose needed */}
          <div className="flex-1 pb-8 min-w-0">
            {step}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Step({ children }: StepProps) {
  return <div className="space-y-3">{children}</div>
}

