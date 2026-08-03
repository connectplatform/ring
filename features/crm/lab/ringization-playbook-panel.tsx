'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import {
  getPlaybookSteps,
  RINGIZATION_PLAYBOOK_DOCS_PATH,
  type PlaybookRole,
} from '@/features/crm/lab/ringization-playbook'
import type { Locale } from '@/i18n/shared'
import { Button } from '@/components/ui/button'

export function RingizationPlaybookPanel({
  role,
  locale,
}: {
  role: PlaybookRole
  locale: Locale
}) {
  const [open, setOpen] = useState(role !== 'buyer')
  const steps = getPlaybookSteps(role)
  const docsHref = `/${locale}${RINGIZATION_PLAYBOOK_DOCS_PATH.replace(/^\//, '/')}`

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4 text-primary" />
          Ringization playbook
        </span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            {steps.map((s) => (
              <li key={s.id}>
                <span className="font-medium text-foreground">{s.title}</span>
                <span className="block text-xs">{s.detail}</span>
              </li>
            ))}
          </ol>
          <Button asChild size="sm" variant="outline">
            <Link href={docsHref}>Open full playbook docs</Link>
          </Button>
        </div>
      ) : null}
    </section>
  )
}
