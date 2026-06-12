export interface CalculatorInputs {
  useCase: string
  userScale: string
  modules: string[]
  database: string
  tokenEconomy: boolean
  region: string
}

export interface CalculatorResults {
  estimatedHours: number
  complexity: 'simple' | 'medium' | 'complex'
  recommendedConfig: {
    database: string
    hosting: string
    features: string[]
  }
  ringTokenEstimate: number
  hostingCostMonthly: number
  customizationComplexity: number
  timeline: {
    week1: string[]
    week2: string[]
    week3: string[]
    week4: string[]
  }
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
}
