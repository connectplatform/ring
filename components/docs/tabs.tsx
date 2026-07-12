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
  /** Preferred — matches TabsList trigger value. */
  value?: string
  /** Alias for `value` (legacy MDX used title=). */
  title?: string
  children: React.ReactNode
}

function tabPanelValue(props: DocsTabProps): string | undefined {
  return props.value || props.title
}

function collectTabValues(children: React.ReactNode): string[] {
  const values: string[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<DocsTabProps>(child)) {
      const v = tabPanelValue(child.props)
      if (v) values.push(v)
    }
  })
  return values
}

/** MDX-friendly tabs — triggers from `items` or from child `<Tab value="…">` / `title="…"` panels. */
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

export function Tab({ value, title, children }: DocsTabProps) {
  const panelValue = value || title
  if (!panelValue) {
    return <div className="space-y-4">{children}</div>
  }
  return <TabsContent value={panelValue}>{children}</TabsContent>
}
