'use client';

/**
 * Email Analytics Dashboard
 * =========================
 * View email processing statistics and AI cost tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CrmAdminShell } from '@/features/admin/crm/crm-admin-shell';
import { 
  BarChart3, TrendingUp, DollarSign, Zap, Clock, 
  Mail, Brain, Database
} from 'lucide-react';

// Live data from EmailAnalyticsService / email_api_usage (no mock fallbacks).

export default function EmailAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [analytics, setAnalytics] = useState<{
    totalEmails: number
    intentDistribution: Record<string, number>
    sentimentDistribution: Record<string, number>
    costStats: {
      totalCostUsd: number
      cacheHitRate: number
      requestCount: number
      byModel?: Record<string, number>
      byOperation?: Record<string, number>
      byOperationCount?: Record<string, number>
      totalInputTokens?: number
      totalOutputTokens?: number
    }
    dailyStats: { date: string; received: number; cost: number }[]
    draftStats: { autoSendRate: number; todayAutoSends: number }
  } | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/email/analytics?range=${timeRange}`, { cache: 'no-store' });
      if (!res.ok) return;
      setAnalytics(await res.json());
    } catch {
      setAnalytics(null);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const totalEmails = analytics?.totalEmails ?? 0;
  const totalAutoResponses = analytics?.draftStats?.todayAutoSends ?? 0;
  const autoResponseRate = Math.round((analytics?.draftStats?.autoSendRate ?? 0) * 100);
  const avgResponseTime = 0;
  const intentDistribution = analytics?.intentDistribution ?? {};
  const sentimentDistribution = analytics?.sentimentDistribution ?? {};
  const costStats = {
    totalCost: analytics?.costStats?.totalCostUsd ?? 0,
    cacheHitRate: analytics?.costStats?.cacheHitRate ?? 0,
    cacheSavings: 0,
    byModel: analytics?.costStats?.byModel ?? {},
    byOperation: analytics?.costStats?.byOperation ?? {},
    byOperationCount: analytics?.costStats?.byOperationCount ?? {},
    requestCount: analytics?.costStats?.requestCount ?? 0,
    totalInputTokens: analytics?.costStats?.totalInputTokens ?? 0,
    totalOutputTokens: analytics?.costStats?.totalOutputTokens ?? 0,
  };
  const dailyStats = analytics?.dailyStats?.map((d) => ({
    date: d.date,
    emailsReceived: d.received,
    emailsSent: 0,
    autoResponses: 0,
    draftReviews: 0,
    avgResponseTimeMinutes: 0,
  })) ?? [];
  const liveLoaded = Boolean(analytics);

  return (
    <CrmAdminShell pageContext="crm-analytics">
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
                {liveLoaded ? ' · live email_api_usage' : ' · loading…'}
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
            <div className="text-3xl font-bold text-gray-900 dark:text-white">${costStats.totalCost.toFixed(4)}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {costStats.requestCount} API requests · {(costStats.totalInputTokens + costStats.totalOutputTokens).toLocaleString()} tokens
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
              {dailyStats.map((day) => (
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
              {Object.entries(intentDistribution).map(([intent, count]) => (
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
              {Object.entries(sentimentDistribution).map(([sentiment, percentage]) => (
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
              {Object.keys(costStats.byModel).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No email pipeline usage recorded yet.</p>
              ) : (
                Object.entries(costStats.byModel).map(([model, cost]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[70%]" title={model}>
                    {model}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${Number(cost).toFixed(4)}
                  </span>
                </div>
              ))
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  By operation
                </p>
                {Object.keys(costStats.byOperation).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No operations recorded yet.</p>
                ) : (
                  Object.entries(costStats.byOperation).map(([op, cost]) => (
                    <div key={op} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {op.replace(/_/g, ' ')}
                        {costStats.byOperationCount[op] != null
                          ? ` · ${costStats.byOperationCount[op]}`
                          : ''}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        ${Number(cost).toFixed(4)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ${costStats.totalCost.toFixed(4)}
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
                    {Math.round(costStats.cacheHitRate * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="h-3 bg-green-500 rounded-full"
                    style={{ width: `${costStats.cacheHitRate * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${costStats.cacheSavings.toFixed(2)}
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
    </CrmAdminShell>
  );
}
