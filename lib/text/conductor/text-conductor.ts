import { getTextPollTimeoutMs, getTextProvider } from '@/lib/text/text.config'
import { generateXaiText } from '@/lib/text/providers/xai.provider'
import type {
  GenerateTextContext,
  GenerateTextResult,
  JsonSchemaSpec,
  TextProviderId,
} from '@/lib/text/conductor/types'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Text generation timed out after ${timeoutMs}ms`)), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

async function generateFromProvider(provider: TextProviderId, ctx: GenerateTextContext) {
  if (provider !== 'xai') {
    throw new Error(`Unsupported text provider: ${provider}`)
  }
  return generateXaiText(ctx)
}

export const TextConductor = {
  async generate(ctx: GenerateTextContext): Promise<GenerateTextResult> {
    if (!ctx.input?.trim()) {
      return { success: false, error: 'input is required' }
    }

    try {
      const provider = getTextProvider(ctx.provider)
      const output = await withTimeout(generateFromProvider(provider, ctx), getTextPollTimeoutMs())

      return {
        success: true,
        text: output.text,
        structured: output.structured,
        citations: output.citations,
        model: output.model,
        provider,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  },

  async generateStructured<T extends Record<string, unknown>>(
    ctx: Omit<GenerateTextContext, 'jsonSchema'>,
    schema: JsonSchemaSpec
  ): Promise<GenerateTextResult & { structured?: T }> {
    const result = await this.generate({ ...ctx, jsonSchema: schema })
    if (!result.success) return result
    if (!result.structured) {
      return { ...result, success: false, error: 'Structured output missing from provider response' }
    }
    return { ...result, structured: result.structured as T }
  },
}
