export type TextProviderId = 'xai'

export interface JsonSchemaSpec {
  name: string
  strict?: boolean
  schema: Record<string, unknown>
}

export interface GenerateTextContext {
  input: string
  instructions?: string
  provider?: TextProviderId
  model?: string
  webSearch?: boolean
  xSearch?: boolean
  allowedDomains?: string[]
  excludedDomains?: string[]
  jsonSchema?: JsonSchemaSpec
  maxTokens?: number
}

export interface GenerateTextResult {
  success: boolean
  text?: string
  structured?: Record<string, unknown>
  citations?: string[]
  model?: string
  provider?: TextProviderId
  error?: string
}
