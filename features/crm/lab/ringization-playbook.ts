/**
 * Product SSOT — Ringization / feature-overlay playbook for Order Lab + calculator.
 * Keep aligned with `.cursor/agents/ringization-implementer.md` (IDE agent; not imported).
 */

export type PlaybookRole = 'buyer' | 'integrator' | 'admin'

export type PlaybookStep = {
  id: string
  title: string
  detail: string
  roles: PlaybookRole[]
}

export const RINGIZATION_PLAYBOOK_DOCS_PATH = '/docs/customization/ringization-playbook'

/** Marker prefixed on Order Lab seed messages for idempotent re-assign. */
export const PLAYBOOK_SEED_MARKER = '<!-- ringization-playbook-seed -->'

const STEPS: PlaybookStep[] = [
  {
    id: 'feature-id',
    title: 'Choose FEATURE_ID + target clone',
    detail:
      'Pick a short id (e.g. n9life) matching ring-<clone>/ and a top-level ring-config domain key with the same name.',
    roles: ['buyer', 'integrator', 'admin'],
  },
  {
    id: 'tier1-config',
    title: 'Tier-1: ring-config.json thin overlay',
    detail:
      'Brand, seo, home.preset, entities.preset, and domain block only. Never fork platform core for clone product.',
    roles: ['buyer', 'integrator', 'admin'],
  },
  {
    id: 'tier2-presets',
    title: 'Tier-2: named presets',
    detail:
      'home-presets/<id>-landing.tsx, entities/productFields presets when shared niches are not enough.',
    roles: ['integrator', 'admin'],
  },
  {
    id: 'tier3-registry',
    title: 'Tier-3: lib/overlay/registry.ts',
    detail:
      'Register clone-only i18n append + home rail on the clone. Platform registries stay empty (build-safe).',
    roles: ['integrator', 'admin'],
  },
  {
    id: 'feature-modules',
    title: 'features/<id>/* modules',
    detail:
      'Domain UI, services, and appendOverlayMessages live under features/<FEATURE_ID>/ on the clone only.',
    roles: ['integrator', 'admin'],
  },
  {
    id: 'reggie-exclude',
    title: 'Reggie exclude hygiene',
    detail:
      'List registry, features/<id>, landing, locales, and ring-config in .reggie-propagate-exclude.json.',
    roles: ['integrator', 'admin'],
  },
  {
    id: 'clone-build',
    title: 'Build via ringdom-clone-build / Forgejo',
    detail:
      'Merge platform + clone overlay; push to forge.ringdom.org/ringdom-clones/<slug>; BuildKit → private OCI.',
    roles: ['integrator', 'admin'],
  },
  {
    id: 'ban-list',
    title: 'Hard bans',
    detail:
      'Do not edit ring-platform.org for clone product; no brand LocaleFileId cases; no Cosmic Mirror in platform home-wrapper.',
    roles: ['buyer', 'integrator', 'admin'],
  },
]

export function getPlaybookSteps(role: PlaybookRole): PlaybookStep[] {
  return STEPS.filter((s) => s.roles.includes(role))
}

export function formatPlaybookMarkdown(role: PlaybookRole = 'integrator'): string {
  const steps = getPlaybookSteps(role)
  const lines = [
    '## Ringization playbook (feature overlay)',
    '',
    `Docs: ${RINGIZATION_PLAYBOOK_DOCS_PATH}`,
    '',
    ...steps.map((s, i) => `${i + 1}. **${s.title}** — ${s.detail}`),
    '',
    'Factory for disk clone: `reggie_autonomous_clone` (not reggie-ringize plans).',
  ]
  return lines.join('\n')
}
