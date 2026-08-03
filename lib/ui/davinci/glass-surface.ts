import { cn } from '@/lib/utils'

/** Shared DaVinci glassmorphism surface classes — tiles use 15px radius SSOT */
export const davinciGlassSurface = cn(
  'davinci-glass-surface rounded-[15px]',
  'hover:border-white/20 hover:bg-white/10 transition-all duration-300'
)

/** Inner fill that masks the border-beam center (Grok terminal pattern) */
export const davinciBeamInnerSurface = cn(
  'rounded-[inherit] bg-[var(--davinci-surface-bg)]/95 backdrop-blur-md',
  'border border-primary/[0.06] hover:border-primary/15',
  'shadow-sm transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]'
)

export const davinciAuthButtonLift =
  'transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0'

export const davinciPanelSurface = cn(
  'davinci-panel-surface rounded-[15px]',
  'transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5'
)

export const davinciTerminalSurface = cn(
  'davinci-terminal-surface rounded-[15px]',
  'transition-[border-color,box-shadow] duration-200',
  'hover:border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)]'
)

/** Fully-rounded DaVinci CTA / button chrome */
export const davinciCtaPrimary = cn(
  'davinci-cta-primary rounded-[99px]',
  '!text-foreground font-semibold',
)
