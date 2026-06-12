'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { PlatformAISettingsView } from '@/features/admin/platform-settings/types'
import {
  LLM_PROVIDER_OPTIONS,
  STREAMING_STRATEGY_OPTIONS,
} from '@/features/admin/platform-settings/types'
import type {
  PlatformSettingsActionState,
  TestConnectionResult,
} from '@/app/_actions/platform-settings'
import { Zap } from 'lucide-react'

const MASKED = '••••••••'

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? '…' : label}
    </Button>
  )
}

type AISettingsSectionProps = {
  initial: PlatformAISettingsView
  updateAction: (
    prev: PlatformSettingsActionState | null,
    formData: FormData,
  ) => Promise<PlatformSettingsActionState>
  testConnectionAction: () => Promise<TestConnectionResult>
}

export function AISettingsSection({
  initial,
  updateAction,
  testConnectionAction,
}: AISettingsSectionProps) {
  const t = useTranslations('modules.admin.settings.sections.ai')
  const [state, formAction] = useActionState(updateAction, null)
  const [provider, setProvider] = useState(initial.data.llmProvider)
  const [streamingStrategy, setStreamingStrategy] = useState(initial.data.streamingStrategy)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [testing, setTesting] = useState(false)

  const modelPresets: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    openrouter: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o'],
    xai: ['grok-4.3', 'grok-3'],
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnectionAction()
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          {state && (
            <Alert variant={state.success ? 'default' : 'destructive'}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="llmProvider">{t('provider')}</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as typeof provider)}
              >
                <SelectTrigger id="llmProvider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="llmProvider" value={provider} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="llmModel">{t('model')}</Label>
              <Input id="llmModel" name="llmModel" defaultValue={initial.data.llmModel} />
              <div className="flex flex-wrap gap-1">
                {(modelPresets[provider] || []).map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const el = document.getElementById('llmModel') as HTMLInputElement | null
                      if (el) el.value = preset
                    }}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="streamingStrategy">{t('streamingStrategy')}</Label>
              <Select
                value={streamingStrategy}
                onValueChange={(v) => setStreamingStrategy(v as typeof streamingStrategy)}
              >
                <SelectTrigger id="streamingStrategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STREAMING_STRATEGY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`streaming.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="streamingStrategy" value={streamingStrategy} />
              <p className="text-xs text-muted-foreground">{t(`streamingHint.${streamingStrategy}`)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('apiKeys')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ['openaiApiKey', 'OpenAI', initial.secrets.hasOpenaiApiKey],
                  ['anthropicApiKey', 'Anthropic', initial.secrets.hasAnthropicApiKey],
                  ['openrouterApiKey', 'OpenRouter', initial.secrets.hasOpenrouterApiKey],
                  ['xaiApiKey', 'xAI', initial.secrets.hasXaiApiKey],
                ] as const
              ).map(([name, label, hasKey]) => (
                <div key={name} className="space-y-2">
                  <Label htmlFor={name}>
                    {label}
                    {hasKey ? (
                      <span className="ml-2 text-xs text-emerald-600">({t('keySet')})</span>
                    ) : null}
                  </Label>
                  <Input
                    id={name}
                    name={name}
                    type="password"
                    autoComplete="off"
                    placeholder={hasKey ? MASKED : t('keyPlaceholder')}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matcherScoreThreshold">{t('matcher.scoreThreshold')}</Label>
              <Input
                id="matcherScoreThreshold"
                name="matcherScoreThreshold"
                type="number"
                step="0.05"
                min="0"
                max="1"
                defaultValue={initial.data.matcher.scoreThreshold}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matcherMaxMatches">{t('matcher.maxMatches')}</Label>
              <Input
                id="matcherMaxMatches"
                name="matcherMaxMatches"
                type="number"
                min="1"
                max="100"
                defaultValue={initial.data.matcher.maxMatches}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <input
                  id="matcher_auto_approve"
                  name="matcher_auto_approve"
                  type="checkbox"
                  defaultChecked={initial.data.matcher.autoApprove}
                  className="mt-1 h-4 w-4"
                />
                <div className="space-y-1">
                  <Label htmlFor="matcher_auto_approve" className="cursor-pointer">
                    {t('matcher.autoApprove')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('matcher.autoApproveHelp')}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="matcher_auto_approve_min_score">
                {t('matcher.autoApproveMinScore')}
              </Label>
              <Input
                id="matcher_auto_approve_min_score"
                name="matcher_auto_approve_min_score"
                type="number"
                step="0.05"
                min="0"
                max="1"
                defaultValue={initial.data.matcher.autoApproveMinScore}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productAgentMaxTokens">{t('productAgent.maxTokens')}</Label>
              <Input
                id="productAgentMaxTokens"
                name="productAgentMaxTokens"
                type="number"
                min="64"
                max="8000"
                defaultValue={initial.data.productAgent.maxTokens}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productAgentTemperature">{t('productAgent.temperature')}</Label>
              <Input
                id="productAgentTemperature"
                name="productAgentTemperature"
                type="number"
                step="0.05"
                min="0"
                max="2"
                defaultValue={initial.data.productAgent.temperature}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="button" variant="outline" disabled={testing} onClick={handleTest}>
              <Zap className="mr-2 h-4 w-4" />
              {testing ? t('testing') : t('testConnection')}
            </Button>
            <SaveButton label={t('save')} />
          </div>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}

          {initial.updatedAt && (
            <p className="text-xs text-muted-foreground">
              {t('lastUpdated', { at: new Date(initial.updatedAt).toLocaleString() })}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
