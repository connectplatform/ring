/**
 * Unified LLM Client for Ring Platform
 *
 * Supports multiple LLM providers with automatic fallback and cost optimization.
 * Designed for opportunity matching, auto-fill, and user analysis features.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
}

export class LLMError extends Error {
  provider: string;
  model: string;
  code?: string;
  retryable: boolean;

  constructor(message: string, options: {
    provider: string;
    model: string;
    code?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'LLMError';
    this.provider = options.provider;
    this.model = options.model;
    this.code = options.code;
    this.retryable = options.retryable ?? true;
  }
}

/**
 * Unified LLM Client with provider abstraction and fallback support
 */
export class LLMClient {
  private config: LLMConfig;
  private fallbackClient?: LLMClient;

  constructor(config: LLMConfig, fallbackConfig?: LLMConfig) {
    this.config = config;
    if (fallbackConfig) {
      this.fallbackClient = new LLMClient(fallbackConfig);
    }
  }

  /**
   * Get API key from environment or config
   */
  private getApiKey(): string {
    if (this.config.apiKey) return this.config.apiKey;

    const envKey = this.config.provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!envKey) {
      throw new LLMError(`Missing API key for ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        retryable: false
      });
    }

    return envKey;
  }

  /**
   * Make a completion request to the LLM
   */
  async complete(prompt: string, options: Partial<LLMConfig> = {}): Promise<LLMResponse> {
    const requestConfig = { ...this.config, ...options };

    try {
      const apiKey = this.getApiKey();

      if (requestConfig.provider === 'openai') {
        return await this.callOpenAI(prompt, requestConfig, apiKey);
      } else if (requestConfig.provider === 'anthropic') {
        return await this.callAnthropic(prompt, requestConfig, apiKey);
      } else {
        throw new LLMError(`Unsupported provider: ${requestConfig.provider}`, {
          provider: requestConfig.provider,
          model: requestConfig.model,
          retryable: false
        });
      }
    } catch (error) {
      // Try fallback if available and error is retryable
      if (this.fallbackClient && error instanceof LLMError && error.retryable) {
        console.warn(`LLM: Primary provider failed, trying fallback: ${error.message}`);
        return await this.fallbackClient.complete(prompt, options);
      }

      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, config: LLMConfig, apiKey: string): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        {
          provider: 'openai',
          model: config.model,
          code: errorData.error?.code,
          retryable: response.status >= 500 || response.status === 429
        }
      );
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined,
      provider: 'openai',
      model: config.model
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, config: LLMConfig, apiKey: string): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens ?? 1000,
        temperature: config.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new LLMError(
        `Anthropic API error: ${response.status} ${response.statusText}`,
        {
          provider: 'anthropic',
          model: config.model,
          code: errorData.error?.type,
          retryable: response.status >= 500 || response.status === 429
        }
      );
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || '',
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined,
      provider: 'anthropic',
      model: config.model
    };
  }

  /**
   * Batch completion for multiple prompts (cost optimization)
   */
  async batchComplete(prompts: string[], options: Partial<LLMConfig> = {}): Promise<LLMResponse[]> {
    // For now, process sequentially. Could be optimized for parallel processing
    const results: LLMResponse[] = [];

    for (const prompt of prompts) {
      try {
        const result = await this.complete(prompt, options);
        results.push(result);
      } catch (error) {
        console.error('LLM: Batch completion failed for prompt:', error);
        // Continue with other prompts even if one fails
        results.push({
          content: '',
          provider: this.config.provider,
          model: this.config.model
        });
      }
    }

    return results;
  }
}

/**
 * Factory function to create LLM client with environment-based configuration
 */
export function createLLMClient(fallback: boolean = true): LLMClient {
  const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic';

  const primaryConfig: LLMConfig = {
    provider,
    model: provider === 'openai'
      ? (process.env.LLM_MODEL || 'gpt-4o')
      : (process.env.LLM_MODEL || 'claude-3-5-sonnet-20241022'),
    temperature: 0.7,
    maxTokens: 1000
  };

  let fallbackConfig: LLMConfig | undefined;

  if (fallback) {
    // Create fallback config with opposite provider
    if (provider === 'openai' && process.env.ANTHROPIC_API_KEY) {
      fallbackConfig = {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 1000
      };
    } else if (provider === 'anthropic' && process.env.OPENAI_API_KEY) {
      fallbackConfig = {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1000
      };
    }
  }

  return new LLMClient(primaryConfig, fallbackConfig);
}

/**
 * Utility function to estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Utility function to check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}
