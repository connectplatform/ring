'use client'

import React from 'react'

export interface StepsProps {
  children: React.ReactNode
}

export interface StepProps {
  children: React.ReactNode
}

const stepContentClass =
  'min-w-0 flex-1 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_h4:first-child]:mt-0 [&_p:first-child]:mt-0'

export function Steps({ children }: StepsProps) {
  const steps = React.Children.toArray(children)

  return (
    <ol className="my-8 list-none space-y-0">
      {steps.map((step, index) => (
        <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2 bg-border"
            />
          ) : null}
          <span
            aria-hidden
            className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold leading-none text-primary"
          >
            {index + 1}
          </span>
          <div className={stepContentClass}>{step}</div>
        </li>
      ))}
    </ol>
  )
}

export function Step({ children }: StepProps) {
  return <div className="space-y-2">{children}</div>
}
