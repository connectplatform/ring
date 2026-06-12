import type {
  CalculatorInputs,
  CalculatorResults,
  DeploymentCalculationContext,
} from './types'

export function calculateDeployment(
  inputs: CalculatorInputs,
  ctx: DeploymentCalculationContext,
): CalculatorResults {
  const selectedModules = ctx.modules.filter((m) => inputs.modules.includes(m.id))
  const selectedDatabase = ctx.databases.find((d) => d.id === inputs.database)!
  const selectedScale = ctx.userScales.find((s) => s.id === inputs.userScale)!
  const selectedRegion = ctx.regions.find((r) => r.id === inputs.region)!

  const moduleHours = selectedModules.reduce((sum, module) => sum + module.baseHours, 0)
  const databaseHours = selectedDatabase.setupHours
  const tokenHours = inputs.tokenEconomy ? 20 : 0
  const baseHours = moduleHours + databaseHours + tokenHours
  const scaledHours = Math.round(baseHours * selectedScale.multiplier)

  let complexity: CalculatorResults['complexity'] = 'simple'
  if (scaledHours > 100) complexity = 'complex'
  else if (scaledHours > 50) complexity = 'medium'

  const hostingCost = selectedRegion.cost + selectedDatabase.cost
  const ringTokenEstimate = Math.round(scaledHours * 2)
  const timeline = ctx.timelineTasks[complexity]

  return {
    estimatedHours: scaledHours,
    complexity,
    recommendedConfig: {
      database: selectedDatabase.name,
      hosting: selectedRegion.hosting,
      features: selectedModules.map((m) => m.name),
    },
    ringTokenEstimate,
    hostingCostMonthly: hostingCost,
    customizationComplexity: Math.round((scaledHours / 80) * 100),
    timeline,
  }
}
