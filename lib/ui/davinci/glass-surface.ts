import { cn } from '@/lib/utils'

/** Shared DaVinci glassmorphism surface classes */
export const davinciGlassSurface = cn(
  'davinci-glass-surface rounded-2xl',
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
  'davinci-panel-surface rounded-2xl',
  'transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5'
)

export const davinciTerminalSurface = cn(
  'davinci-terminal-surface rounded-xl',
  'transition-[border-color,box-shadow] duration-200',
  'hover:border-[color-mix(in_oklch,var(--davinci-beam)_40%,transparent)]'
)

export const davinciCtaPrimary = cn(
  'davinci-cta-primary rounded-xl',
  'text-foreground font-semibold'
)
