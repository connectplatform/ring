'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Calculator, Clock, DollarSign, Users, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CalculatorInputs {
  useCase: string;
  userScale: string;
  modules: string[];
  database: string;
  tokenEconomy: boolean;
  region: string;
}

interface CalculatorResults {
  estimatedHours: number;
  complexity: 'simple' | 'medium' | 'complex';
  recommendedConfig: {
    database: string;
    hosting: string;
    features: string[];
  };
  ringTokenEstimate: number;
  hostingCostMonthly: number;
  customizationComplexity: number;
  timeline: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
}

const getUseCases = (t: any) => [
  { id: 'marketplace', name: t('useCases.marketplace.name'), description: t('useCases.marketplace.description') },
  { id: 'opportunities', name: t('useCases.opportunities.name'), description: t('useCases.opportunities.description') },
  { id: 'cooperative', name: t('useCases.cooperative.name'), description: t('useCases.cooperative.description') },
  { id: 'community', name: t('useCases.community.name'), description: t('useCases.community.description') },
  { id: 'enterprise', name: t('useCases.enterprise.name'), description: t('useCases.enterprise.description') },
];

const getUserScales = (t: any) => [
  { id: 'small', name: t('userScales.small'), multiplier: 1 },
  { id: 'medium', name: t('userScales.medium'), multiplier: 1.5 },
  { id: 'large', name: t('userScales.large'), multiplier: 2.5 },
  { id: 'enterprise', name: t('userScales.enterprise'), multiplier: 4 },
];

const availableModules = [
  { id: 'auth', name: 'Authentication', baseHours: 2, description: 'User login and registration' },
  { id: 'entities', name: 'Entities', baseHours: 4, description: 'Organization and user profiles' },
  { id: 'opportunities', name: 'Opportunities', baseHours: 8, description: 'Job/project posting and matching' },
  { id: 'messaging', name: 'Messaging', baseHours: 6, description: 'Real-time communication' },
  { id: 'store', name: 'Store', baseHours: 12, description: 'E-commerce marketplace' },
  { id: 'wallet', name: 'Wallet', baseHours: 10, description: 'Token and payment management' },
  { id: 'nft', name: 'NFT Market', baseHours: 16, description: 'NFT marketplace and trading' },
  { id: 'staking', name: 'Staking', baseHours: 8, description: 'Token staking system' },
  { id: 'analytics', name: 'Analytics', baseHours: 6, description: 'User and platform analytics' },
  { id: 'api', name: 'API Access', baseHours: 4, description: 'REST API for integrations' },
];

const databases = [
  { id: 'firebase', name: 'Firebase', setupHours: 1, cost: 0, description: 'Easiest setup, scales automatically' },
  { id: 'postgresql', name: 'PostgreSQL', setupHours: 4, cost: 50, description: 'Production-ready, full SQL power' },
  { id: 'connect', name: 'ConnectPlatform', setupHours: 2, cost: 200, description: 'Enterprise features included' },
];

const regions = [
  { id: 'global', name: 'Global', hosting: 'Vercel/DigitalOcean', cost: 50 },
  { id: 'europe', name: 'Europe', hosting: 'EU-based hosting', cost: 45 },
  { id: 'asia', name: 'Asia', hosting: 'Asia-based hosting', cost: 35 },
  { id: 'americas', name: 'Americas', hosting: 'US-based hosting', cost: 40 },
];

export function DeploymentCalculator() {
  const t = useTranslations('deployment-calculator');
  const useCases = getUseCases(t);
  const userScales = getUserScales(t);

  const [inputs, setInputs] = useState<CalculatorInputs>({
    useCase: '',
    userScale: '',
    modules: [],
    database: '',
    tokenEconomy: false,
    region: '',
  });

  const [results, setResults] = useState<CalculatorResults | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateDeployment = async () => {
    setIsCalculating(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const selectedModules = availableModules.filter(m => inputs.modules.includes(m.id));
    const selectedDatabase = databases.find(d => d.id === inputs.database)!;
    const selectedScale = userScales.find(s => s.id === inputs.userScale)!;
    const selectedRegion = regions.find(r => r.id === inputs.region)!;

    // Calculate base hours
    const moduleHours = selectedModules.reduce((sum, module) => sum + module.baseHours, 0);
    const databaseHours = selectedDatabase.setupHours;
    const tokenHours = inputs.tokenEconomy ? 20 : 0; // Token setup is complex
    const baseHours = moduleHours + databaseHours + tokenHours;

    // Apply scale multiplier
    const scaledHours = Math.round(baseHours * selectedScale.multiplier);

    // Determine complexity
    let complexity: 'simple' | 'medium' | 'complex' = 'simple';
    if (scaledHours > 100) complexity = 'complex';
    else if (scaledHours > 50) complexity = 'medium';

    // Calculate costs
    const hostingCost = selectedRegion.cost + selectedDatabase.cost;
    const ringTokenEstimate = Math.round(scaledHours * 2); // Rough estimate: 2 RING per hour

    // Generate timeline
    const timeline = generateTimeline(inputs, selectedModules, complexity);

    const results: CalculatorResults = {
      estimatedHours: scaledHours,
      complexity,
      recommendedConfig: {
        database: selectedDatabase.name,
        hosting: selectedRegion.hosting,
        features: selectedModules.map(m => m.name),
      },
      ringTokenEstimate,
      hostingCostMonthly: hostingCost,
      customizationComplexity: Math.round((scaledHours / 80) * 100), // Percentage
      timeline,
    };

    setResults(results);
    setIsCalculating(false);
  };

  const generateTimeline = (inputs: CalculatorInputs, modules: any[], complexity: string) => {
    const baseTimeline = {
      week1: ['Platform setup and basic configuration'],
      week2: ['Core module implementation'],
      week3: ['Testing and refinements'],
      week4: ['Deployment and launch'],
    };

    // Customize based on complexity
    if (complexity === 'complex') {
      return {
        week1: ['Platform architecture planning', 'Database setup', 'Security configuration'],
        week2: ['Core modules (Auth, Entities)', 'Basic AI matching setup'],
        week3: ['Advanced modules (Store, Wallet)', 'Token economy implementation'],
        week4: ['Integration testing', 'Performance optimization', 'Production deployment'],
      };
    } else if (complexity === 'medium') {
      return {
        week1: ['Platform setup', 'Database configuration'],
        week2: ['Core modules implementation'],
        week3: ['Advanced features and testing'],
        week4: ['Deployment and monitoring setup'],
      };
    }

    return baseTimeline;
  };

  const isFormValid = inputs.useCase && inputs.userScale && inputs.modules.length > 0 &&
                     inputs.database && inputs.region;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Calculator className="h-8 w-8" />
          {t('hero.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('hero.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calculator">{t('hero.title')}</TabsTrigger>
          <TabsTrigger value="results" disabled={!results}>{t('results.title')}</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('configuration.title')}</CardTitle>
              <CardDescription>
                {t('configuration.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Use Case Selection */}
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

              {/* User Scale */}
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

              {/* Modules Selection */}
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
                            setInputs({
                              ...inputs,
                              modules: [...inputs.modules, module.id]
                            });
                          } else {
                            setInputs({
                              ...inputs,
                              modules: inputs.modules.filter(m => m !== module.id)
                            });
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

              {/* Database Selection */}
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
                        Setup: {db.setupHours}h | ${db.cost}/mo
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token Economy */}
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
                    <AlertDescription>
                      {t('tokenEconomy.warning')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Geographic Region */}
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
                      <div className="text-sm text-muted-foreground">${region.cost}/mo</div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={calculateDeployment}
                disabled={!isFormValid || isCalculating}
                className="w-full"
                size="lg"
              >
                {isCalculating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold">{results.estimatedHours}</div>
                        <div className="text-sm text-muted-foreground">Hours</div>
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
                        <div className="text-sm text-muted-foreground">Monthly</div>
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
                        <div className="text-sm text-muted-foreground">RING tokens</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`h-5 w-5 ${
                        results.complexity === 'simple' ? 'text-green-500' :
                        results.complexity === 'medium' ? 'text-yellow-500' : 'text-red-500'
                      }`} />
                      <div>
                        <div className="text-lg font-bold capitalize">{results.complexity}</div>
                        <div className="text-sm text-muted-foreground">Complexity</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommended Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Database</Label>
                    <div className="text-sm text-muted-foreground">{results.recommendedConfig.database}</div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Hosting</Label>
                    <div className="text-sm text-muted-foreground">{results.recommendedConfig.hosting}</div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Features</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {results.recommendedConfig.features.map((feature, index) => (
                        <Badge key={index} variant="secondary">{feature}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle>4-Week Deployment Timeline</CardTitle>
                  <CardDescription>Recommended rollout schedule</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(results.timeline).map(([week, tasks], index) => (
                    <div key={week} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium capitalize">{week.replace('week', 'Week ')}</div>
                        <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                          {tasks.map((task, taskIndex) => (
                            <li key={taskIndex} className="flex items-center space-x-2">
                              <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Complexity Indicator */}
              <Card>
                <CardHeader>
                  <CardTitle>Customization Complexity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Complexity Level</span>
                      <span>{results.customizationComplexity}%</span>
                    </div>
                    <Progress value={results.customizationComplexity} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      {results.customizationComplexity < 30
                        ? "Low complexity - focus on branding and basic configuration"
                        : results.customizationComplexity < 70
                        ? "Medium complexity - consider professional development help"
                        : "High complexity - recommend Ring customization services"
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Next Steps */}
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button asChild>
                      <Link href="/docs/library/white-label/quick-start">
                        Start Building
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/opportunities?type=ring_customization">
                        Find Developers
                      </Link>
                    </Button>
                  </div>

                  {results.complexity === 'complex' && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        For complex deployments, we recommend posting a customization opportunity
                        to connect with experienced Ring developers.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
