/**
 * Email AI Processing Module
 * ==========================
 */

// Intent Classifier
export { IntentClassifier, getIntentClassifier } from './intent-classifier';
export type { EmailIntent, IntentClassification } from './intent-classifier';

// Sentiment Analyzer
export { SentimentAnalyzer, getSentimentAnalyzer } from './sentiment-analyzer';
export type { SentimentCategory, SentimentAnalysis } from './sentiment-analyzer';

// Context Builder
export { ContextBuilder, getContextBuilder } from './context-builder';
export type { 
  EmailContext, 
  ThreadMessage, 
  KnowledgeArticle, 
  ResponseTemplate, 
  FAQ 
} from './context-builder';

// Response Generator
export { ResponseGenerator, getResponseGenerator } from './response-generator';
export type { ResponseGenerationResult, ToolUsageRecord } from './response-generator';

// Cost Tracker
export { CostTracker, getCostTracker } from './cost-tracker';
export type { UsageRecord, OperationType, DailyStats } from './cost-tracker';

// Batch Analytics
export { BatchAnalyticsService, getBatchAnalyticsService } from './batch-analytics';
export type { BatchJob, BatchJobType, BatchResult, SentimentTrendResult, DailySummaryResult } from './batch-analytics';
