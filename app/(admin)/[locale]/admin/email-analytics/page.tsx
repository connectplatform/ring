'use client';

/**
 * Email Analytics Dashboard
 * =========================
 * View email processing statistics and AI cost tracking
 */

import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, Zap, Clock, 
  Mail, CheckCircle, AlertTriangle, Brain, Database
} from 'lucide-react';

interface DailyStats {
  date: string;
  emailsReceived: number;
  emailsSent: number;
  autoResponses: number;
  draftReviews: number;
  avgResponseTimeMinutes: number;
}

interface CostStats {
  totalCost: number;
  byModel: { [key: string]: number };
  cacheHitRate: number;
  cacheSavings: number;
}

// Mock data
const MOCK_DAILY_STATS: DailyStats[] = [
  { date: '2026-02-03', emailsReceived: 45, emailsSent: 42, autoResponses: 28, draftReviews: 14, avgResponseTimeMinutes: 15 },
  { date: '2026-02-02', emailsReceived: 38, emailsSent: 35, autoResponses: 22, draftReviews: 13, avgResponseTimeMinutes: 18 },
  { date: '2026-02-01', emailsReceived: 52, emailsSent: 48, autoResponses: 35, draftReviews: 13, avgResponseTimeMinutes: 12 },
  { date: '2026-01-31', emailsReceived: 41, emailsSent: 40, autoResponses: 26, draftReviews: 14, avgResponseTimeMinutes: 20 },
  { date: '2026-01-30', emailsReceived: 36, emailsSent: 33, autoResponses: 21, draftReviews: 12, avgResponseTimeMinutes: 22 },
];

const MOCK_COST_STATS: CostStats = {
  totalCost: 12.47,
  byModel: {
    'claude-haiku': 2.15,
    'claude-sonnet': 8.92,
    'claude-opus': 1.40,
  },
  cacheHitRate: 0.73,
  cacheSavings: 8.23,
};

const MOCK_INTENT_DISTRIBUTION = {
  technical_support: 28,
  general_inquiry: 22,
  feature_request: 15,
  documentation_help: 12,
  pricing_inquiry: 10,
  enterprise_inquiry: 8,
  other: 5,
};

const MOCK_SENTIMENT_DISTRIBUTION = {
  positive: 35,
  neutral: 45,
  negative: 12,
  frustrated: 8,
};

export default function EmailAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  const totalEmails = MOCK_DAILY_STATS.reduce((acc, d) => acc + d.emailsReceived, 0);
  const totalAutoResponses = MOCK_DAILY_STATS.reduce((acc, d) => acc + d.autoResponses, 0);
  const autoResponseRate = Math.round((totalAutoResponses / totalEmails) * 100);
  const avgResponseTime = Math.round(
    MOCK_DAILY_STATS.reduce((acc, d) => acc + d.avgResponseTimeMinutes, 0) / MOCK_DAILY_STATS.length
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Analytics</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-powered email processing insights
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Emails</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalEmails}</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              <TrendingUp className="h-4 w-4 inline mr-1" />
              +12% vs last week
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Auto-Response Rate</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{autoResponseRate}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {totalAutoResponses} auto-sent
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{avgResponseTime}m</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              <TrendingUp className="h-4 w-4 inline mr-1" />
              -5m vs last week
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">API Cost (Week)</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">${MOCK_COST_STATS.totalCost}</div>
            <div className="text-sm text-green-600 dark:text-green-400 mt-1">
              ${MOCK_COST_STATS.cacheSavings} saved via cache
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Email Volume Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Volume
            </h3>
            <div className="space-y-4">
              {MOCK_DAILY_STATS.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div 
                      className="h-6 bg-blue-500 rounded-sm"
                      style={{ width: `${(day.emailsReceived / 60) * 100}%` }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{day.emailsReceived}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Intent Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Intent Distribution
            </h3>
            <div className="space-y-3">
              {Object.entries(MOCK_INTENT_DISTRIBUTION).map(([intent, count]) => (
                <div key={intent} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300 w-36 capitalize">
                    {intent.replace('_', ' ')}
                  </span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="h-3 bg-indigo-500 rounded-full"
                      style={{ width: `${count}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                    {count}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sentiment Analysis */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sentiment Breakdown
            </h3>
            <div className="space-y-4">
              {Object.entries(MOCK_SENTIMENT_DISTRIBUTION).map(([sentiment, percentage]) => (
                <div key={sentiment} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      sentiment === 'positive' ? 'bg-green-500' :
                      sentiment === 'neutral' ? 'bg-gray-400' :
                      sentiment === 'negative' ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{sentiment}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Model Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Model Costs
            </h3>
            <div className="space-y-4">
              {Object.entries(MOCK_COST_STATS.byModel).map(([model, cost]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                    {model.replace('claude-', 'Claude ')}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${cost.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ${MOCK_COST_STATS.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cache Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Cache Performance
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">Hit Rate</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {Math.round(MOCK_COST_STATS.cacheHitRate * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="h-3 bg-green-500 rounded-full"
                    style={{ width: `${MOCK_COST_STATS.cacheHitRate * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${MOCK_COST_STATS.cacheSavings.toFixed(2)}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Saved this week via prompt caching
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
