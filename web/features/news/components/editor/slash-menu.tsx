'use client'

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { SlashCommandItem } from './extensions/slash-commands'
import { cn } from '@/lib/utils'

export type SlashMenuHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

type SlashMenuProps = {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { items, command },
  ref,
) {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setSelected(0)
  }, [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected((i) => (i + items.length - 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((i) => (i + 1) % Math.max(items.length, 1))
        return true
      }
      if (event.key === 'Enter') {
        const item = items[selected]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  if (!items.length) {
    return (
      <div className="z-50 min-w-[240px] rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
        No commands
      </div>
    )
  }

  let lastGroup = ''
  return (
    <div className="z-50 max-h-72 min-w-[260px] overflow-auto rounded-md border bg-popover p-1 shadow-lg">
      {items.map((item, index) => {
        const showGroup = item.group !== lastGroup
        lastGroup = item.group
        return (
          <React.Fragment key={`${item.group}-${item.title}`}>
            {showGroup ? (
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.group}
              </div>
            ) : null}
            <button
              type="button"
              className={cn(
                'flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                index === selected && 'bg-accent',
              )}
              onClick={() => command(item)}
            >
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
})
