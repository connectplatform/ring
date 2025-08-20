'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Monitor, 
  Zap, 
  Clock, 
  Eye, 
  MousePointer, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface WebVitalsMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

interface PerformanceReport {
  metrics: WebVitalsMetric[]
  score: number
  timestamp: number
  buildId: string
  sessionId: string
}

interface PerformanceDashboardProps {
  userId?: string
  showDetails?: boolean
  refreshInterval?: number
}

// Web Vitals thresholds
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 }
}

export default function PerformanceDashboard({ 
  userId, 
  showDetails = true, 
  refreshInterval = 30000 
}: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<WebVitalsMetric[]>([])
  const [reports, setReports] = useState<PerformanceReport[]>([])
  const [score, setScore] = useState<number>(0)
  const [isCollecting, setIsCollecting] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h')

  // Mock Web Vitals data for demonstration
  useEffect(() => {
    const mockMetrics: WebVitalsMetric[] = [
      { name: 'LCP', value: 1847, rating: 'good', timestamp: Date.now() },
      { name: 'FID', value: 89, rating: 'good', timestamp: Date.now() },
      { name: 'CLS', value: 0.085, rating: 'good', timestamp: Date.now() },
      { name: 'FCP', value: 1456, rating: 'good', timestamp: Date.now() },
      { name: 'TTFB', value: 623, rating: 'good', timestamp: Date.now() },
      { name: 'INP', value: 156, rating: 'good', timestamp: Date.now() }
    ]

    const mockReports: PerformanceReport[] = [
      {
        metrics: mockMetrics,
        score: 94,
        timestamp: Date.now(),
        buildId: 'v0.7.5-build-123',
        sessionId: 'session-456'
      }
    ]

    setMetrics(mockMetrics)
    setReports(mockReports)
    setScore(94)
    setIsCollecting(true)
    setLastUpdated(new Date())
  }, [])

  const getMetricIcon = (name: string) => {
    switch (name) {
      case 'LCP': return <Eye className="h-4 w-4" />
      case 'FID': return <MousePointer className="h-4 w-4" />
      case 'CLS': return <Monitor className="h-4 w-4" />
      case 'FCP': return <Zap className="h-4 w-4" />
      case 'TTFB': return <Clock className="h-4 w-4" />
      case 'INP': return <Activity className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getMetricDescription = (name: string) => {
    switch (name) {
      case 'LCP': return 'Largest Contentful Paint - Loading performance'
      case 'FID': return 'First Input Delay - Interactivity (legacy)'
      case 'CLS': return 'Cumulative Layout Shift - Visual stability'
      case 'FCP': return 'First Contentful Paint - Rendering performance'
      case 'TTFB': return 'Time to First Byte - Server response time'
      case 'INP': return 'Interaction to Next Paint - Interactivity'
      default: return 'Web Vitals metric'
    }
  }

  const formatMetricValue = (name: string, value: number) => {
    if (name === 'CLS') {
      return value.toFixed(3)
    }
    return `${Math.round(value)}ms`
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50'
      case 'poor': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-600" />
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    return <XCircle className="h-5 w-5 text-red-600" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time Web Vitals monitoring and analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isCollecting ? "default" : "secondary"}>
            {isCollecting ? 'Collecting' : 'Paused'}
          </Badge>
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Performance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {getScoreIcon(score)}
            <span>Performance Score</span>
          </CardTitle>
          <CardDescription>
            Overall performance based on Core Web Vitals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {score}
            </div>
            <div className="flex-1">
              <Progress value={score} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>Poor</span>
                <span>Needs Improvement</span>
                <span>Good</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.name} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  {getMetricIcon(metric.name)}
                  <span>{metric.name}</span>
                </CardTitle>
                <Badge 
                  variant="outline" 
                  className={getRatingColor(metric.rating)}
                >
                  {metric.rating.replace('-', ' ')}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {getMetricDescription(metric.name)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMetricValue(metric.name, metric.value)}
              </div>
              <div className="flex items-center mt-2 text-sm text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                <span>Good performance</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Analytics */}
      {showDetails && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
                <CardDescription>
                  Analysis and recommendations based on current metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Excellent Performance</AlertTitle>
                  <AlertDescription>
                    Your site is performing well across all Core Web Vitals metrics. 
                    Keep up the good work!
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Strong Points</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Fast loading times (LCP: 1.8s)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Minimal layout shifts (CLS: 0.085)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span>Quick server response (TTFB: 623ms)</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Recommendations</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center space-x-2">
                        <TrendingUp className="h-3 w-3 text-blue-500" />
                        <span>Consider image optimization</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <TrendingUp className="h-3 w-3 text-blue-500" />
                        <span>Implement service worker caching</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <TrendingUp className="h-3 w-3 text-blue-500" />
                        <span>Monitor performance regularly</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
                <CardDescription>
                  Historical performance data and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Performance trends will be available after collecting more data</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Insights</CardTitle>
                <CardDescription>
                  Intelligent analysis of your performance data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertTitle>Performance Opportunity</AlertTitle>
                    <AlertDescription>
                      Based on your current metrics, implementing code splitting could 
                      improve your LCP by an estimated 15-20%.
                    </AlertDescription>
                  </Alert>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>React 19 Benefits</AlertTitle>
                    <AlertDescription>
                      Your recent React 19 upgrade has improved performance by 12% 
                      compared to previous builds. Great optimization work!
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Monitoring Settings</CardTitle>
                <CardDescription>
                  Configure how performance data is collected and analyzed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Real-time Collection</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically collect Web Vitals data from users
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    {isCollecting ? 'Pause' : 'Resume'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Data Retention</h4>
                    <p className="text-sm text-muted-foreground">
                      Keep performance data for 30 days
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when performance degrades
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Set up
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
} 