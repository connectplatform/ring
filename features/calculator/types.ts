import type {
  ProjectExternalId,
  ProjectHostingId,
  ProjectModuleId,
  ProjectNicheId,
  ProjectScaleId,
} from './presets/project'
import type { CalculatorRates } from './rates'

export interface CalculatorInputs {
  niche: ProjectNicheId | ''
  scale: ProjectScaleId | ''
  modules: ProjectModuleId[]
  externals: ProjectExternalId[]
  hosting: ProjectHostingId | ''
  branding: boolean
  /** When true, integrator request is advertised on order activation. */
  needHumanDev: boolean
}

export interface CalculatorResults {
  /** Internal credit-point totals (SSOT for display conversion). */
  oneTimePoints: number
  monthlyPoints: number
  alaCartePoints: number
  packSavingsPoints: number
  /** Fiat (store.mainCurrency) mirrors for convenience. */
  oneTimeFiat: number
  monthlyFiat: number
  alaCarteFiat: number
  packSavingsFiat: number
  /** Native token mirrors. */
  oneTimeNative: number
  monthlyNative: number
  estimatedHours: number
  complexity: 'simple' | 'medium' | 'complex'
  customizationComplexity: number
  recommendedConfig: {
    niche: string
    hosting: string
    modules: string[]
    externals: string[]
    needHumanDev: boolean
  }
  timeline: {
    week1: string[]
    week2: string[]
    week3: string[]
    week4: string[]
  }
  rates: CalculatorRates
}

export interface ProjectCalculationLabels {
  nicheName: string
  hostingLabel: string
  moduleNames: Record<string, string>
  externalNames: Record<string, string>
}

export interface ProjectCalculationContext {
  labels: ProjectCalculationLabels
  timelineTasks: Record<'simple' | 'medium' | 'complex', CalculatorResults['timeline']>
  rates: CalculatorRates
}

/** @deprecated Legacy deployment calculator shapes — kept for preset/deployment.ts */
export interface DeploymentCalculatorInputs {
  useCase: string
  userScale: string
  modules: string[]
  database: string
  tokenEconomy: boolean
  region: string
}

export interface CalculatorModuleDef {
  id: string
  baseHours: number
  name: string
  description: string
}

export interface CalculatorDatabaseDef {
  id: string
  setupHours: number
  cost: number
  name: string
  description: string
}

export interface CalculatorRegionDef {
  id: string
  cost: number
  name: string
  hosting: string
}

export interface CalculatorUserScaleDef {
  id: string
  name: string
  multiplier: number
}

export interface DeploymentCalculationContext {
  modules: CalculatorModuleDef[]
  databases: CalculatorDatabaseDef[]
  regions: CalculatorRegionDef[]
  userScales: CalculatorUserScaleDef[]
  timelineTasks: Record<'simple' | 'medium' | 'complex', CalculatorResults['timeline']>
  rates: CalculatorRates
}
