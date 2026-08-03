import type {
  CalculatorInputs,
  CalculatorResults,
  DeploymentCalculationContext,
  DeploymentCalculatorInputs,
  ProjectCalculationContext,
} from './types'
import {
  BRANDING_CUSTOMIZATION_POINTS,
  HOSTING_BASE_POINTS_MONTHLY,
  PACK_MODULE_DISCOUNT,
  PROJECT_EXTERNAL_MAIN_CURRENCY,
  PROJECT_HOSTING_CONSTRUCT_MULT,
  PROJECT_MODULE_POINTS,
  PROJECT_NICHE_BASE_CONSTRUCT_POINTS,
  PROJECT_NICHE_MODULES,
  PROJECT_SCALE_MULTIPLIERS,
  type ProjectExternalId,
  type ProjectHostingId,
  type ProjectModuleId,
  type ProjectNicheId,
  type ProjectScaleId,
} from './presets/project'
import {
  creditBalanceUnitToMainCurrency,
  creditBalanceUnitToNativeToken,
  mainCurrencyToCreditBalanceUnit,
} from './rates'

export function calculateProject(
  inputs: CalculatorInputs,
  ctx: ProjectCalculationContext,
): CalculatorResults {
  const niche = inputs.niche as ProjectNicheId
  const scale = inputs.scale as ProjectScaleId
  const hosting = inputs.hosting as ProjectHostingId
  const scaleMult = PROJECT_SCALE_MULTIPLIERS[scale]
  const hostingMult = PROJECT_HOSTING_CONSTRUCT_MULT[hosting]
  const rates = ctx.rates

  const packModules = new Set(PROJECT_NICHE_MODULES[niche])
  const selected = inputs.modules

  let packModulePoints = 0
  let extraModulePoints = 0
  let alaCarteModulePoints = 0

  for (const id of selected) {
    const price = PROJECT_MODULE_POINTS[id as ProjectModuleId] ?? 0
    alaCarteModulePoints += price
    if (packModules.has(id as ProjectModuleId)) {
      packModulePoints += Math.round(price * PACK_MODULE_DISCOUNT * 100) / 100
    } else {
      extraModulePoints += price
    }
  }

  const baseConstruct = PROJECT_NICHE_BASE_CONSTRUCT_POINTS[niche]
  const brandingPoints = inputs.branding ? BRANDING_CUSTOMIZATION_POINTS : 0

  const oneTimePoints = Math.round(
    (baseConstruct + packModulePoints + extraModulePoints + brandingPoints) *
      hostingMult *
      scaleMult *
      100,
  ) / 100

  const alaCartePoints = Math.round(
    (baseConstruct + alaCarteModulePoints + brandingPoints) * hostingMult * scaleMult * 100,
  ) / 100

  const packSavingsPoints = Math.max(
    0,
    Math.round((alaCartePoints - oneTimePoints) * 100) / 100,
  )

  const hostingPoints =
    hosting === 'self_host' ? 0 : Math.round(HOSTING_BASE_POINTS_MONTHLY * scaleMult * 100) / 100

  let externalPoints = 0
  for (const ext of inputs.externals) {
    const mainCurrency = PROJECT_EXTERNAL_MAIN_CURRENCY[ext as ProjectExternalId] ?? 0
    externalPoints += mainCurrencyToCreditBalanceUnit(mainCurrency, rates)
  }
  // Ringdom hosting includes managed CDN narrative — no extra auto-charge;
  // ringcdn remains an explicit external toggle for capacity beyond included plane.
  const monthlyPoints = Math.round((hostingPoints + externalPoints) * 100) / 100

  const estimatedHours = Math.max(8, Math.round(oneTimePoints / 5))

  let complexity: CalculatorResults['complexity'] = 'simple'
  if (estimatedHours > 100 || selected.length > 8) complexity = 'complex'
  else if (estimatedHours > 50 || selected.length > 5) complexity = 'medium'

  const customizationComplexity = Math.min(100, Math.round((estimatedHours / 120) * 100))

  return {
    oneTimePoints,
    monthlyPoints,
    alaCartePoints,
    packSavingsPoints,
    oneTimeFiat: creditBalanceUnitToMainCurrency(oneTimePoints, rates),
    monthlyFiat: creditBalanceUnitToMainCurrency(monthlyPoints, rates),
    alaCarteFiat: creditBalanceUnitToMainCurrency(alaCartePoints, rates),
    packSavingsFiat: creditBalanceUnitToMainCurrency(packSavingsPoints, rates),
    oneTimeNative: creditBalanceUnitToNativeToken(oneTimePoints, rates),
    monthlyNative: creditBalanceUnitToNativeToken(monthlyPoints, rates),
    estimatedHours,
    complexity,
    customizationComplexity,
    recommendedConfig: {
      niche: ctx.labels.nicheName,
      hosting: ctx.labels.hostingLabel,
      modules: selected.map((id) => ctx.labels.moduleNames[id] ?? id),
      externals: inputs.externals.map((id) => ctx.labels.externalNames[id] ?? id),
      needHumanDev: inputs.needHumanDev,
    },
    timeline: ctx.timelineTasks[complexity],
    rates,
  }
}

/** Legacy deployment calculator — retained for deployment preset consumers. */
export function calculateDeployment(
  inputs: DeploymentCalculatorInputs,
  ctx: DeploymentCalculationContext,
): CalculatorResults {
  const selectedModules = ctx.modules.filter((m) => inputs.modules.includes(m.id))
  const selectedDatabase = ctx.databases.find((d) => d.id === inputs.database)!
  const selectedScale = ctx.userScales.find((s) => s.id === inputs.userScale)!
  const selectedRegion = ctx.regions.find((r) => r.id === inputs.region)!
  const rates = ctx.rates

  const moduleHours = selectedModules.reduce((sum, module) => sum + module.baseHours, 0)
  const databaseHours = selectedDatabase.setupHours
  const tokenHours = inputs.tokenEconomy ? 20 : 0
  const baseHours = moduleHours + databaseHours + tokenHours
  const scaledHours = Math.round(baseHours * selectedScale.multiplier)

  let complexity: CalculatorResults['complexity'] = 'simple'
  if (scaledHours > 100) complexity = 'complex'
  else if (scaledHours > 50) complexity = 'medium'

  const hostingCostMainCurrency = selectedRegion.cost + selectedDatabase.cost
  const oneTimePoints = scaledHours * 5
  const monthlyPoints = mainCurrencyToCreditBalanceUnit(hostingCostMainCurrency, rates)
  const timeline = ctx.timelineTasks[complexity]

  return {
    oneTimePoints,
    monthlyPoints,
    alaCartePoints: oneTimePoints,
    packSavingsPoints: 0,
    oneTimeFiat: creditBalanceUnitToMainCurrency(oneTimePoints, rates),
    monthlyFiat: creditBalanceUnitToMainCurrency(monthlyPoints, rates),
    alaCarteFiat: creditBalanceUnitToMainCurrency(oneTimePoints, rates),
    packSavingsFiat: 0,
    oneTimeNative: creditBalanceUnitToNativeToken(oneTimePoints, rates),
    monthlyNative: creditBalanceUnitToNativeToken(monthlyPoints, rates),
    estimatedHours: scaledHours,
    complexity,
    recommendedConfig: {
      niche: inputs.useCase,
      hosting: selectedRegion.hosting,
      modules: selectedModules.map((m) => m.name),
      externals: [],
      needHumanDev: false,
    },
    customizationComplexity: Math.round((scaledHours / 80) * 100),
    timeline,
    rates,
  }
}
