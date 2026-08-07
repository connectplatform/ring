/**
 * Anthropic API Cost Tracker
 * ==========================
 * Tracks API usage, costs, and cache effectiveness
 * Reference: Email Automation Specialist skillset
 */

import { logger } from '@/lib/logger';

export interface UsageRecord {
  requestId: string;
  emailId: string | null;
  model: string;
  operation: OperationType;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  timestamp: Date;
}

export type OperationType = 
  | 'intent_classification'
  | 'sentiment_analysis'
  | 'injection_classification'
  | 'response_generation'
  | 'batch_analytics';

// Model pricing (per 1M tokens)
const PRICING = {
  'claude-haiku-4-5-20250514': {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.025,
    cacheWrite: 0.30,
  },
  'claude-sonnet-4-20250514': {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75,
  },
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,
    cacheWrite: 18.75,
  },
};

// Batch processing discount
const BATCH_DISCOUNT = 0.5; // 50% off for batch operations

export interface DailyStats {
  date: string;
  totalCost: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  costByModel: Record<string, number>;
  costByOperation: Record<string, number>;
  tokensByModel: Record<string, { input: number; output: number }>;
}

export class CostTracker {
  private records: UsageRecord[] = [];
  private dailyStatsCache: Map<string, DailyStats> = new Map();
  
  // Callbacks for persistence (implement in app)
  private onRecordCreated: ((record: UsageRecord) => Promise<void>) | null = null;
  
  /**
   * Calculate cost for a request
   */
  calculateCost(
    model: string,
    tokens: {
      input: number;
      output: number;
      cacheRead?: number;
      cacheWrite?: number;
    },
    isBatch = false
  ): number {
    const pricing = PRICING[model as keyof typeof PRICING];
    if (!pricing) {
      logger.warn('[CostTracker] Unknown model pricing', { model });
      return 0;
    }
    
    const inputCost = (tokens.input * pricing.input) / 1_000_000;
    const outputCost = (tokens.output * pricing.output) / 1_000_000;
    const cacheReadCost = ((tokens.cacheRead || 0) * pricing.cacheRead) / 1_000_000;
    const cacheWriteCost = ((tokens.cacheWrite || 0) * pricing.cacheWrite) / 1_000_000;
    
    let totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;
    
    // Apply batch discount
    if (isBatch) {
      totalCost *= (1 - BATCH_DISCOUNT);
    }
    
    return Math.round(totalCost * 1_000_000) / 1_000_000;
  }
  
  /**
   * Record API usage
   */
  async recordUsage(
    params: Omit<UsageRecord, 'costUsd' | 'timestamp' | 'requestId'>
  ): Promise<UsageRecord> {
    const costUsd = this.calculateCost(
      params.model,
      {
        input: params.inputTokens,
        output: params.outputTokens,
        cacheRead: params.cacheReadTokens,
        cacheWrite: params.cacheWriteTokens,
      },
      params.operation === 'batch_analytics'
    );
    
    const record: UsageRecord = {
      ...params,
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      costUsd,
      timestamp: new Date(),
    };
    
    this.records.push(record);
    
    // Persist if callback is set
    if (this.onRecordCreated) {
      try {
        await this.onRecordCreated(record);
      } catch (error) {
        logger.error('[CostTracker] Failed to persist record', {
          error: (error as Error).message,
        });
      }
    }
    
    logger.debug('[CostTracker] Usage recorded', {
      requestId: record.requestId,
      model: record.model,
      operation: record.operation,
      costUsd: record.costUsd,
      cacheReadTokens: record.cacheReadTokens,
    });
    
    return record;
  }
  
  /**
   * Get daily statistics
   */
  getDailyStats(date: Date = new Date()): DailyStats {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check cache
    if (this.dailyStatsCache.has(dateStr)) {
      return this.dailyStatsCache.get(dateStr)!;
    }
    
    // Filter records for date
    const dayRecords = this.records.filter(r => 
      r.timestamp.toISOString().split('T')[0] === dateStr
    );
    
    if (dayRecords.length === 0) {
      return {
        date: dateStr,
        totalCost: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: 0,
        cacheHitRate: 0,
        costByModel: {},
        costByOperation: {},
        tokensByModel: {},
      };
    }
    
    // Calculate statistics
    const totalCost = dayRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const totalRequests = dayRecords.length;
    const successfulRequests = dayRecords.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const avgLatencyMs = dayRecords.reduce((sum, r) => sum + r.latencyMs, 0) / totalRequests;
    
    // Calculate cache hit rate
    const totalInputTokens = dayRecords.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalCacheReadTokens = dayRecords.reduce((sum, r) => sum + r.cacheReadTokens, 0);
    const cacheHitRate = totalInputTokens > 0 ? totalCacheReadTokens / totalInputTokens : 0;
    
    // Cost by model
    const costByModel: Record<string, number> = {};
    for (const record of dayRecords) {
      costByModel[record.model] = (costByModel[record.model] || 0) + record.costUsd;
    }
    
    // Cost by operation
    const costByOperation: Record<string, number> = {};
    for (const record of dayRecords) {
      costByOperation[record.operation] = (costByOperation[record.operation] || 0) + record.costUsd;
    }
    
    // Tokens by model
    const tokensByModel: Record<string, { input: number; output: number }> = {};
    for (const record of dayRecords) {
      if (!tokensByModel[record.model]) {
        tokensByModel[record.model] = { input: 0, output: 0 };
      }
      tokensByModel[record.model].input += record.inputTokens;
      tokensByModel[record.model].output += record.outputTokens;
    }
    
    const stats: DailyStats = {
      date: dateStr,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgLatencyMs: Math.round(avgLatencyMs),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      costByModel,
      costByOperation,
      tokensByModel,
    };
    
    // Cache if date is complete (not today)
    const today = new Date().toISOString().split('T')[0];
    if (dateStr !== today) {
      this.dailyStatsCache.set(dateStr, stats);
    }
    
    return stats;
  }
  
  /**
   * Get monthly cost summary
   */
  getMonthlySummary(year: number, month: number): {
    totalCost: number;
    totalRequests: number;
    avgDailyCost: number;
    projectedMonthlyCost: number;
    cacheHitRate: number;
    costByModel: Record<string, number>;
  } {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    
    const monthRecords = this.records.filter(r => 
      r.timestamp.toISOString().startsWith(monthStr)
    );
    
    const totalCost = monthRecords.reduce((sum, r) => sum + r.costUsd, 0);
    const totalRequests = monthRecords.length;
    
    // Calculate days elapsed
    const now = new Date();
    const monthStart = new Date(year, month - 1, 1);
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const avgDailyCost = totalCost / daysElapsed;
    const projectedMonthlyCost = avgDailyCost * daysInMonth;
    
    // Cache hit rate
    const totalInputTokens = monthRecords.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalCacheReadTokens = monthRecords.reduce((sum, r) => sum + r.cacheReadTokens, 0);
    const cacheHitRate = totalInputTokens > 0 ? totalCacheReadTokens / totalInputTokens : 0;
    
    // Cost by model
    const costByModel: Record<string, number> = {};
    for (const record of monthRecords) {
      costByModel[record.model] = (costByModel[record.model] || 0) + record.costUsd;
    }
    
    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalRequests,
      avgDailyCost: Math.round(avgDailyCost * 100) / 100,
      projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      costByModel,
    };
  }
  
  /**
   * Get cache effectiveness metrics
   */
  getCacheMetrics(): {
    totalCacheSavings: number;
    hitRate: number;
    avgSavingsPerRequest: number;
  } {
    let totalSavings = 0;
    let requestsWithCache = 0;
    
    for (const record of this.records) {
      if (record.cacheReadTokens > 0) {
        const pricing = PRICING[record.model as keyof typeof PRICING];
        if (pricing) {
          // Savings = what we would have paid for input vs what we paid for cache read
          const inputPrice = (record.cacheReadTokens * pricing.input) / 1_000_000;
          const cachePrice = (record.cacheReadTokens * pricing.cacheRead) / 1_000_000;
          totalSavings += inputPrice - cachePrice;
          requestsWithCache++;
        }
      }
    }
    
    const totalInputTokens = this.records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalCacheReadTokens = this.records.reduce((sum, r) => sum + r.cacheReadTokens, 0);
    const hitRate = totalInputTokens > 0 ? totalCacheReadTokens / totalInputTokens : 0;
    
    return {
      totalCacheSavings: Math.round(totalSavings * 100) / 100,
      hitRate: Math.round(hitRate * 100) / 100,
      avgSavingsPerRequest: requestsWithCache > 0 
        ? Math.round((totalSavings / requestsWithCache) * 100) / 100 
        : 0,
    };
  }
  
  /**
   * Set persistence callback
   */
  setPersistenceCallback(callback: (record: UsageRecord) => Promise<void>): void {
    this.onRecordCreated = callback;
  }
  
  /**
   * Load historical records (call on startup)
   */
  loadRecords(records: UsageRecord[]): void {
    this.records = records;
    this.dailyStatsCache.clear();
  }
  
  /**
   * Clear old records (memory management)
   */
  clearOldRecords(daysToKeep = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    const originalCount = this.records.length;
    this.records = this.records.filter(r => r.timestamp >= cutoff);
    
    return originalCount - this.records.length;
  }
}

// Singleton
let trackerInstance: CostTracker | null = null;

export function getCostTracker(): CostTracker {
  if (!trackerInstance) {
    trackerInstance = new CostTracker();
  }
  return trackerInstance;
}

export default CostTracker;
