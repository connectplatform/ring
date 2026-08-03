import { cn } from '@/lib/utils'
import {
  BorderBeam,
  DavinciGlassChip,
  davinciBeamInnerSurface,
  davinciGlassSurface,
} from '@/lib/ui/davinci'
import { renderGfmModCached } from '@/lib/docs/render-gfm-mod'
import type { ChangelogEntry } from '@/lib/changelog/types'
import type { Locale } from '@/i18n/shared'

/** Horizontal inset for text — mirrors about-publisher compact recipe. */
const INSET = 'px-4 sm:px-5 lg:px-6'

export interface ChangelogArticleProps {
  entries: ChangelogEntry[]
  title: string
  subtitle: string
  brandLabel?: string
  locale: Locale
  emptyLabel?: string
}

async function ChangelogModBlock({
  markdown,
  locale,
}: {
  markdown: string
  locale: Locale
}) {
  const node = await renderGfmModCached(markdown, locale)
  if (!node) return null
  return <div className="changelog-mod min-w-0">{node}</div>
}

async function ChangelogEntryCard({
  entry,
  locale,
}: {
  entry: ChangelogEntry
  locale: Locale
}) {
  return (
    <BorderBeam
      duration="9s"
      className={cn(davinciGlassSurface, 'rounded-[15px]')}
      innerClassName={cn(davinciBeamInnerSurface, 'space-y-3 p-4 sm:p-5')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DavinciGlassChip>v{entry.version}</DavinciGlassChip>
        <time
          dateTime={entry.date}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {entry.date}
        </time>
      </div>
      <div className="space-y-4">
        {entry.mods.map((mod, index) => (
          <ChangelogModBlock
            key={`${entry.version}-${index}`}
            markdown={mod}
            locale={locale}
          />
        ))}
      </div>
    </BorderBeam>
  )
}

/** Center-pane changelog: locale JSON entries as DaVinci-glass cards (no HTML string sink). */
export async function ChangelogArticle({
  entries,
  title,
  subtitle,
  brandLabel = 'Ring Platform',
  locale,
  emptyLabel = 'No changelog entries yet.',
}: ChangelogArticleProps) {
  return (
    <article className={cn('mx-auto w-full max-w-3xl py-6 sm:py-8', INSET)}>
      <header className="mb-6 space-y-1.5 border-b border-border/60 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {brandLabel}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          {entries.map((entry) => (
            <ChangelogEntryCard
              key={`${entry.version}-${entry.date}`}
              entry={entry}
              locale={locale}
            />
          ))}
        </div>
      )}
    </article>
  )
}
