'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Calculator, Clock, DollarSign, Users, Zap } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { calculateDeployment } from './engine'
import type { CalculatorInputs, CalculatorResults } from './types'
import {
  DEPLOYMENT_DATABASE_IDS,
  DEPLOYMENT_DATABASE_META,
  DEPLOYMENT_MODULE_HOURS,
  DEPLOYMENT_MODULE_IDS,
  DEPLOYMENT_REGION_COSTS,
  DEPLOYMENT_REGION_IDS,
  DEPLOYMENT_USE_CASE_IDS,
} from './presets/deployment'

type CalcT = ReturnType<typeof useTranslations<'calculator'>>

const getUseCases = (t: CalcT) =>
  DEPLOYMENT_USE_CASE_IDS.map((id) => ({
    id,
    name: t(`useCases.${id}.name`),
    description: t(`useCases.${id}.description`),
  }))

const getUserScales = (t: CalcT) => [
  { id: 'small', name: t('userScales.small'), multiplier: 1 },
  { id: 'medium', name: t('userScales.medium'), multiplier: 1.5 },
  { id: 'large', name: t('userScales.large'), multiplier: 2.5 },
  { id: 'enterprise', name: t('userScales.enterprise'), multiplier: 4 },
]

const getModules = (t: CalcT) =>
  DEPLOYMENT_MODULE_IDS.map((id) => ({
    id,
    baseHours: DEPLOYMENT_MODULE_HOURS[id],
    name: t(`modules.${id}.name`),
    description: t(`modules.${id}.description`),
  }))

const getDatabases = (t: CalcT) =>
  DEPLOYMENT_DATABASE_IDS.map((id) => ({
    id,
    ...DEPLOYMENT_DATABASE_META[id],
    name: t(`databases.${id}.name`),
    description: t(`databases.${id}.description`),
  }))

const getRegions = (t: CalcT) =>
  DEPLOYMENT_REGION_IDS.map((id) => ({
    id,
    cost: DEPLOYMENT_REGION_COSTS[id],
    name: t(`regions.${id}.name`),
    hosting: t(`regions.${id}.hosting`),
  }))

const getTimelineTasks = (t: CalcT, complexity: 'simple' | 'medium' | 'complex') => {
  const raw = t.raw(`timelineTasks.${complexity}`) as Record<string, string[]>
  return {
    week1: raw.week1 ?? [],
    week2: raw.week2 ?? [],
    week3: raw.week3 ?? [],
    week4: raw.week4 ?? [],
  }
}

export function CalculatorEngine() {
  const t = useTranslations('calculator')
  const useCases = useMemo(() => getUseCases(t), [t])
  const userScales = useMemo(() => getUserScales(t), [t])
  const availableModules = useMemo(() => getModules(t), [t])
  const databases = useMemo(() => getDatabases(t), [t])
  const regions = useMemo(() => getRegions(t), [t])

  const [inputs, setInputs] = useState<CalculatorInputs>({
    useCase: '',
    userScale: '',
    modules: [],
    database: '',
    tokenEconomy: false,
    region: '',
  })

  const [results, setResults] = useState<CalculatorResults | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  const calculate = async () => {
    setIsCalculating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const complexityPreview = calculateDeployment(inputs, {
      modules: availableModules,
      databases,
      regions,
      userScales,
      timelineTasks: {
        simple: getTimelineTasks(t, 'simple'),
        medium: getTimelineTasks(t, 'medium'),
        complex: getTimelineTasks(t, 'complex'),
      },
    })

    setResults(complexityPreview)
    setIsCalculating(false)
  }

  const isFormValid =
    inputs.useCase &&
    inputs.userScale &&
    inputs.modules.length > 0 &&
    inputs.database &&
    inputs.region

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Calculator className="h-8 w-8" />
          {t('hero.title')}
        </h1>
        <p className="text-muted-foreground">{t('hero.subtitle')}</p>
      </div>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">{t('hero.title')}</TabsTrigger>
          <TabsTrigger value="results" disabled={!results}>
            {t('results.title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('configuration.title')}</CardTitle>
              <CardDescription>{t('configuration.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.useCase')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {useCases.map((useCase) => (
                    <div
                      key={useCase.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        inputs.useCase === useCase.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setInputs({ ...inputs, useCase: useCase.id })}
                    >
                      <div className="font-medium">{useCase.name}</div>
                      <div className="text-sm text-muted-foreground">{useCase.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.userScale')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {userScales.map((scale) => (
                    <div
                      key={scale.id}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-colors ${
                        inputs.userScale === scale.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setInputs({ ...inputs, userScale: scale.id })}
                    >
                      <div className="font-medium text-sm">{scale.name.split(' ')[0]}</div>
                      <div className="text-xs text-muted-foreground">
                        {scale.name.split(' ').slice(1).join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.modules')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableModules.map((module) => (
                    <div key={module.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={module.id}
                        checked={inputs.modules.includes(module.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setInputs({ ...inputs, modules: [...inputs.modules, module.id] })
                          } else {
                            setInputs({
                              ...inputs,
                              modules: inputs.modules.filter((m) => m !== module.id),
                            })
                          }
                        }}
                      />
                      <div className="flex-1">
                        <Label htmlFor={module.id} className="font-medium cursor-pointer">
                          {module.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                        <Badge variant="secondary" className="mt-1">
                          {module.baseHours}h
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.database')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {databases.map((db) => (
                    <div
                      key={db.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        inputs.database === db.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setInputs({ ...inputs, database: db.id })}
                    >
                      <div className="font-medium">{db.name}</div>
                      <div className="text-sm text-muted-foreground">{db.description}</div>
                      <div className="text-xs mt-2">
                        {t('labels.setupMeta', { hours: db.setupHours, cost: `$${db.cost}` })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.tokenEconomy')}</Label>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="token-economy"
                    checked={inputs.tokenEconomy}
                    onCheckedChange={(checked) =>
                      setInputs({ ...inputs, tokenEconomy: !!checked })
                    }
                  />
                  <Label htmlFor="token-economy" className="cursor-pointer">
                    {t('tokenEconomy.label')}
                  </Label>
                </div>
                {inputs.tokenEconomy && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{t('tokenEconomy.warning')}</AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">{t('questions.region')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {regions.map((region) => (
                    <div
                      key={region.id}
                      className={`p-3 border rounded-lg cursor-pointer text-center transition-colors ${
                        inputs.region === region.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setInputs({ ...inputs, region: region.id })}
                    >
                      <div className="font-medium">{region.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('labels.regionCost', { cost: `$${region.cost}` })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={calculate}
                disabled={!isFormValid || isCalculating}
                className="w-full"
                size="lg"
              >
                {isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('calculating')}
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    {t('calculate')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {results && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{results.estimatedHours}</div>
                        <div className="text-sm text-muted-foreground">{t('results.hours')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <div>
                        <div className="text-2xl font-bold">${results.hostingCostMonthly}</div>
                        <div className="text-sm text-muted-foreground">{t('results.monthly')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-purple-500" />
                      <div>
                        <div className="text-2xl font-bold">{results.ringTokenEstimate}</div>
                        <div className="text-sm text-muted-foreground">{t('results.ringTokens')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle
                        className={`h-5 w-5 ${
                          results.complexity === 'simple'
                            ? 'text-green-500'
                            : results.complexity === 'medium'
                              ? 'text-yellow-500'
                              : 'text-red-500'
                        }`}
                      />
                      <div>
                        <div className="text-lg font-bold">{t(`complexity.${results.complexity}`)}</div>
                        <div className="text-sm text-muted-foreground">{t('results.complexityLabel')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t('results.recommendedConfig')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">{t('results.database')}</Label>
                    <div className="text-sm text-muted-foreground">
                      {results.recommendedConfig.database}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('results.hosting')}</Label>
                    <div className="text-sm text-muted-foreground">
                      {results.recommendedConfig.hosting}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('results.features')}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {results.recommendedConfig.features.map((feature, index) => (
                        <Badge key={index} variant="secondary">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('results.timeline')}</CardTitle>
                  <CardDescription>{t('results.timelineDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(results.timeline).map(([week, tasks], index) => (
                    <div key={week} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{t(`timeline.${week}` as 'timeline.week1')}</div>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          {tasks.map((task, taskIndex) => (
                            <li key={taskIndex} className="flex items-center space-x-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('results.complexity')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('results.complexityLevel')}</span>
                      <span>{results.customizationComplexity}%</span>
                    </div>
                    <Progress value={results.customizationComplexity} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      {results.customizationComplexity < 30
                        ? t('results.complexityHint.low')
                        : results.customizationComplexity < 70
                          ? t('results.complexityHint.medium')
                          : t('results.complexityHint.high')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('results.nextSteps')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button asChild>
                      <Link href="/docs/white-label/quick-start">{t('actions.startBuilding')}</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/opportunities?type=ring_customization">
                        {t('actions.findDevelopers')}
                      </Link>
                    </Button>
                  </div>
                  {results.complexity === 'complex' && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{t('results.complexAlert')}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
