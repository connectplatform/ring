'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import type { Locale } from '@/i18n/shared'
import {
  DavinciGlassPanel,
  DavinciGlassChip,
  davinciCtaPrimary,
  davinciTerminalSurface,
} from '@/lib/ui/davinci'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  CheckCircle2,
  Eye,
  Lightbulb,
  ListChecks,
  Search,
  Briefcase,
  User,
  Zap,
  Shield,
  Sparkles,
  Target,
} from 'lucide-react'
import OpportunitiesNavRail from '@/components/opportunities/opportunities-nav-rail'
import type { LucideIcon } from 'lucide-react'

export type OpportunityFormRailType =
  | 'request'
  | 'offer'
  | 'cv'
  | 'ring_customization'
  | undefined

interface OpportunityFormGuidanceRailProps {
  locale: Locale
  opportunityType?: OpportunityFormRailType
  onNavigate?: () => void
}

function RailHeading({ id, icon, title }: { id: string; icon: React.ReactNode; title: string }) {
  return (
    <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-semibold">
      <span className="text-[var(--davinci-beam)]">{icon}</span>
      {title}
    </h2>
  )
}

function TipRow({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0 rounded-lg border border-[color-mix(in_oklch,var(--davinci-beam)_22%,transparent)] bg-[color-mix(in_oklch,var(--davinci-beam)_10%,transparent)] p-1.5">
        <Icon className="h-3.5 w-3.5 text-[var(--davinci-beam)]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  )
}

function ChecklistItem({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <CheckCircle2
        className={cn(
          'h-4 w-4 shrink-0',
          done ? 'text-[var(--davinci-beam)]' : 'text-muted-foreground/40',
        )}
      />
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}

export default function OpportunityFormGuidanceRail({
  locale,
  opportunityType,
  onNavigate,
}: OpportunityFormGuidanceRailProps) {
  const t = useTranslations('modules.opportunities')
  const rail = (key: string) => t(`formRail.${key}` as Parameters<typeof t>[0])

  const typeKey = opportunityType ?? 'picker'
  const railSection = opportunityType === 'ring_customization' ? 'ring' : typeKey

  const tipsByType: Record<
    string,
    Array<{ icon: LucideIcon; titleKey: string; bodyKey: string }>
  > = {
    request: [
      { icon: Target, titleKey: 'request.tip1Title', bodyKey: 'request.tip1Body' },
      { icon: Lightbulb, titleKey: 'request.tip2Title', bodyKey: 'request.tip2Body' },
      { icon: Eye, titleKey: 'request.tip3Title', bodyKey: 'request.tip3Body' },
    ],
    offer: [
      { icon: Briefcase, titleKey: 'offer.tip1Title', bodyKey: 'offer.tip1Body' },
      { icon: Shield, titleKey: 'offer.tip2Title', bodyKey: 'offer.tip2Body' },
      { icon: Sparkles, titleKey: 'offer.tip3Title', bodyKey: 'offer.tip3Body' },
    ],
    cv: [
      { icon: User, titleKey: 'cv.tip1Title', bodyKey: 'cv.tip1Body' },
      { icon: Zap, titleKey: 'cv.tip2Title', bodyKey: 'cv.tip2Body' },
      { icon: Eye, titleKey: 'cv.tip3Title', bodyKey: 'cv.tip3Body' },
    ],
    ring_customization: [
      { icon: Zap, titleKey: 'ring.tip1Title', bodyKey: 'ring.tip1Body' },
      { icon: Lightbulb, titleKey: 'ring.tip2Title', bodyKey: 'ring.tip2Body' },
      { icon: Shield, titleKey: 'ring.tip3Title', bodyKey: 'ring.tip3Body' },
    ],
    picker: [
      { icon: Search, titleKey: 'picker.tip1Title', bodyKey: 'picker.tip1Body' },
      { icon: Lightbulb, titleKey: 'picker.tip2Title', bodyKey: 'picker.tip2Body' },
    ],
  }

  const checklistByType: Record<string, string[]> = {
    request: ['request.check1', 'request.check2', 'request.check3', 'request.check4'],
    offer: ['offer.check1', 'offer.check2', 'offer.check3', 'offer.check4'],
    cv: ['cv.check1', 'cv.check2', 'cv.check3', 'cv.check4'],
    ring_customization: ['ring.check1', 'ring.check2', 'ring.check3', 'ring.check4'],
    picker: ['picker.check1', 'picker.check2'],
  }

  const tips = tipsByType[typeKey] ?? tipsByType.picker
  const checklist = checklistByType[typeKey] ?? checklistByType.picker

  const docLinks = [
    { label: rail('docsOverview'), href: `${ROUTES.DOCS(locale)}/features/opportunities` },
    { label: rail('docsMatching'), href: `${ROUTES.DOCS(locale)}/features/ai-matching` },
    { label: rail('docsEntities'), href: `${ROUTES.DOCS(locale)}/features/entities` },
  ]

  return (
    <div className="flex min-h-0 flex-col space-y-6 text-foreground">
      <OpportunitiesNavRail locale={locale} onNavigate={onNavigate} />

      <section aria-labelledby="opp-form-rail-tips">
        <RailHeading
          id="opp-form-rail-tips"
          icon={<Lightbulb className="h-5 w-5 shrink-0" />}
          title={rail(`${railSection}.tipsTitle`)}
        />
        <DavinciGlassPanel beamDuration="7s">
          <ul className="space-y-4">
            {tips.map((tip) => (
              <TipRow
                key={tip.titleKey}
                icon={tip.icon}
                title={rail(tip.titleKey)}
                body={rail(tip.bodyKey)}
              />
            ))}
          </ul>
        </DavinciGlassPanel>
      </section>

      <Separator />

      <section aria-labelledby="opp-form-rail-checklist">
        <RailHeading
          id="opp-form-rail-checklist"
          icon={<ListChecks className="h-5 w-5 shrink-0" />}
          title={rail('checklistTitle')}
        />
        <div className={cn(davinciTerminalSurface, 'p-4')}>
          <ul className="space-y-2">
            {checklist.map((key) => (
              <ChecklistItem key={key} label={rail(key)} />
            ))}
          </ul>
        </div>
      </section>

      {opportunityType === 'offer' || opportunityType === 'ring_customization' ? (
        <>
          <Separator />
          <DavinciGlassPanel
            title={rail('memberNoteTitle')}
            description={rail('memberNoteBody')}
            icon={<Shield className="h-3.5 w-3.5" />}
            beamDuration="8s"
          >
            <Badge variant="outline" className="text-xs">
              {rail('memberBadge')}
            </Badge>
          </DavinciGlassPanel>
        </>
      ) : null}

      {opportunityType === 'request' ? (
        <>
          <Separator />
          <DavinciGlassPanel
            title={rail('visibilityTitle')}
            description={rail('request.visibilityBody')}
            icon={<Eye className="h-3.5 w-3.5" />}
            beamDuration="6s"
          />
        </>
      ) : null}

      <Separator />

      <section aria-labelledby="opp-form-rail-guide">
        <RailHeading
          id="opp-form-rail-guide"
          icon={<BookOpen className="h-5 w-5 shrink-0" />}
          title={rail('guideTitle')}
        />
        <p className="mb-3 text-sm text-muted-foreground">{rail('guideDescription')}</p>
        <div className="flex flex-wrap gap-2">
          {docLinks.map((link) => (
            <DavinciGlassChip key={link.href} href={link.href}>
              {link.label}
            </DavinciGlassChip>
          ))}
        </div>
      </section>
    </div>
  )
}
