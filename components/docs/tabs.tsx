'use client'

import React from 'react'
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export interface DocsTabsProps {
  /** Optional — when MDX cannot pass arrays, values are read from `<Tab value="…">` children. */
  items?: string[]
  children: React.ReactNode
  defaultValue?: string
}

export interface DocsTabProps {
  value: string
  children: React.ReactNode
}

function collectTabValues(children: React.ReactNode): string[] {
  const values: string[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<DocsTabProps>(child) && child.props.value) {
      values.push(child.props.value)
    }
  })
  return values
}

/** MDX-friendly tabs — triggers from `items` or from child `<Tab value="…">` panels. */
export function Tabs({ items, children, defaultValue }: DocsTabsProps) {
  const tabValues = (items?.length ? items : collectTabValues(children))
  const first = tabValues[0]

  if (!first) {
    return <div className="my-6 space-y-4">{children}</div>
  }

  return (
    <TabsRoot defaultValue={defaultValue ?? first} className="my-6">
      <TabsList className="mb-4">
        {tabValues.map((item) => (
          <TabsTrigger key={item} value={item}>
            {item}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </TabsRoot>
  )
}

export function Tab({ value, children }: DocsTabProps) {
  return <TabsContent value={value}>{children}</TabsContent>
}
