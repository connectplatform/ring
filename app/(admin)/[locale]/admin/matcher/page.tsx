/**
 * AI Matcher Analytics Dashboard
 *
 * Admin dashboard showing match accuracy, user engagement, auto-fill confidence,
 * and LLM usage analytics for the AI-powered opportunity matcher.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import AdminWrapper from '@/components/wrappers/admin-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Zap,
  DollarSign,
  Clock,
  Award,
  AlertTriangle,
  BarChart3,
  PieChart,
  LineChart,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react';

// Mock data - in real implementation this would come from database/analytics service
const mockAnalyticsData = {
  overview: {
    totalMatches: 15420,
    averageMatchScore: 74.5,
    matchSuccessRate: 68.2,
    totalOpportunities: 2847,
    activeUsers: 1234,
    processingTime: 2.3
  },
  performance: {
    autoFillAccuracy: 85.3,
    matchQualityDistribution: {
      excellent: 32.1, // 80-100
      good: 28.7,      // 70-79
      fair: 25.4,      // 60-69
      poor: 13.8       // <60
    },
    userEngagement: {
      notificationClickRate: 78.5,
      matchAcceptanceRate: 45.2,
      feedbackRate: 12.3
    },
    llmUsage: {
      totalTokens: 2456789,
      totalRequests: 45632,
      averageResponseTime: 2.1,
      costPerMatch: 0.023
    }
  },
  trends: {
    dailyMatches: [
      { date: '2025-09-01', matches: 145, avgScore: 73.2 },
      { date: '2025-09-02', matches: 167, avgScore: 74.8 },
      { date: '2025-09-03', matches: 189, avgScore: 75.1 },
      { date: '2025-09-04', matches: 203, avgScore: 76.3 },
      { date: '2025-09-05', matches: 178, avgScore: 74.9 },
      { date: '2025-09-06', matches: 156, avgScore: 73.7 },
      { date: '2025-09-07', matches: 198, avgScore: 75.8 }
    ],
    weeklyAccuracy: [
      { week: 'Week 1', accuracy: 82.1 },
      { week: 'Week 2', accuracy: 84.3 },
      { week: 'Week 3', accuracy: 85.7 },
      { week: 'Week 4', accuracy: 86.2 }
    ]
  },
  alerts: [
    {
      type: 'warning',
      title: 'High LLM Usage',
      description: 'Token usage has increased 25% this week',
      action: 'Optimize prompts'
    },
    {
      type: 'info',
      title: 'New Record',
      description: 'Achieved 87% match accuracy this month',
      action: null
    }
  ]
};

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  trend,
  description
}) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4" />;
      case 'down': return <TrendingDown className="w-4 h-4" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <p className={`text-sm flex items-center gap-1 ${getTrendColor()}`}>
                {getTrendIcon()}
                {change > 0 ? '+' : ''}{change}% from last period
              </p>
            )}
          </div>
          <Icon className="w-8 h-8 text-gray-400" />
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

const MatcherAnalyticsDashboard: React.FC = () => {
  const t = useTranslations('admin.matcherAnalytics');
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const data = mockAnalyticsData;
    return {
      costSavings: Math.round((data.performance.llmUsage.totalTokens * 0.0001) * 0.6), // 60% cost reduction
      engagementScore: Math.round(
        (data.performance.userEngagement.notificationClickRate +
         data.performance.userEngagement.matchAcceptanceRate) / 2
      ),
      qualityImprovement: 12.3 // Percentage improvement from baseline
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 2000);
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Exporting analytics data...');
  };

  return (
    <AdminWrapper locale="en" pageContext="matcher">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-gray-600">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {mockAnalyticsData.alerts.length > 0 && (
        <div className="space-y-2">
          {mockAnalyticsData.alerts.map((alert, index) => (
            <Alert key={index} className={alert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{alert.title}:</span> {alert.description}
                </div>
                {alert.action && (
                  <Button variant="outline" size="sm">
                    {alert.action}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title={t('metrics.totalMatches')}
          value={mockAnalyticsData.overview.totalMatches.toLocaleString()}
          change={15.2}
          trend="up"
          icon={Users}
          description={t('metrics.totalMatchesDesc')}
        />
        <MetricCard
          title={t('metrics.averageScore')}
          value={`${mockAnalyticsData.overview.averageMatchScore}%`}
          change={5.1}
          trend="up"
          icon={Target}
          description={t('metrics.averageScoreDesc')}
        />
        <MetricCard
          title={t('metrics.engagementRate')}
          value={`${derivedMetrics.engagementScore}%`}
          change={8.3}
          trend="up"
          icon={Zap}
          description={t('metrics.engagementRateDesc')}
        />
        <MetricCard
          title={t('metrics.costSavings')}
          value={`$${derivedMetrics.costSavings}`}
          change={-25.0}
          trend="up"
          icon={DollarSign}
          description={t('metrics.costSavingsDesc')}
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">{t('tabs.performance')}</TabsTrigger>
          <TabsTrigger value="quality">{t('tabs.quality')}</TabsTrigger>
          <TabsTrigger value="usage">{t('tabs.usage')}</TabsTrigger>
          <TabsTrigger value="trends">{t('tabs.trends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  {t('performance.autoFillAccuracy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{mockAnalyticsData.performance.autoFillAccuracy}%</span>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      +{derivedMetrics.qualityImprovement}%
                    </Badge>
                  </div>
                  <Progress value={mockAnalyticsData.performance.autoFillAccuracy} className="h-3" />
                  <p className="text-sm text-gray-600">
                    {t('performance.autoFillDesc')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {t('performance.processingTime')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{mockAnalyticsData.overview.processingTime}s</span>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      -0.3s
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('performance.processingDesc')}
                  </p>
                  <div className="text-xs text-gray-500">
                    Target: &lt; 3 seconds
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('performance.llmUsage')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{mockAnalyticsData.performance.llmUsage.totalTokens.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('performance.totalTokens')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{mockAnalyticsData.performance.llmUsage.totalRequests.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('performance.totalRequests')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{mockAnalyticsData.performance.llmUsage.averageResponseTime}s</div>
                  <div className="text-sm text-muted-foreground">{t('performance.avgResponseTime')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">${mockAnalyticsData.performance.llmUsage.costPerMatch}</div>
                  <div className="text-sm text-muted-foreground">{t('performance.costPerMatch')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('quality.matchDistribution')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mockAnalyticsData.performance.matchQualityDistribution).map(([level, percentage]) => {
                  const getColor = () => {
                    switch (level) {
                      case 'excellent': return 'bg-green-500';
                      case 'good': return 'bg-blue-500';
                      case 'fair': return 'bg-yellow-500';
                      case 'poor': return 'bg-red-500';
                      default: return 'bg-gray-500';
                    }
                  };

                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{t(`quality.levels.${level}`)}</span>
                        <span>{percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${getColor()}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('quality.userEngagement')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">{t('quality.clickRate')}</span>
                  <span className="font-medium">{mockAnalyticsData.performance.userEngagement.notificationClickRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">{t('quality.acceptanceRate')}</span>
                  <span className="font-medium">{mockAnalyticsData.performance.userEngagement.matchAcceptanceRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">{t('quality.feedbackRate')}</span>
                  <span className="font-medium">{mockAnalyticsData.performance.userEngagement.feedbackRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('usage.dailyMatches')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockAnalyticsData.trends.dailyMatches.slice(-7).map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between">
                      <span className="text-sm">{day.date}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{day.matches} matches</span>
                        <Badge variant="outline" className="text-xs">
                          {day.avgScore}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('usage.weeklyAccuracy')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockAnalyticsData.trends.weeklyAccuracy.map((week, index) => (
                    <div key={week.week} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{week.week}</span>
                        <span className="font-medium">{week.accuracy}%</span>
                      </div>
                      <Progress value={week.accuracy} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                {t('trends.matchTrends')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('trends.chartPlaceholder')}</p>
                  <p className="text-sm">{t('trends.chartDesc')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AdminWrapper>
  );
};

export default MatcherAnalyticsDashboard;
