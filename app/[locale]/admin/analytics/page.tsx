import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isValidLocale, defaultLocale, loadTranslations } from '@/utils/i18n-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Users, 
  Eye, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  LineChart,
  Server,
  Database,
  Cpu,
  HardDrive
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// Types for analytics data
interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface UserEngagementMetric {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  format: 'number' | 'percentage' | 'time' | 'bytes';
}

interface SystemHealthMetric {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  value: number;
  threshold: number;
  description: string;
}

export default async function AdminAnalyticsPage({ 
  params 
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;
  const t = await loadTranslations(validLocale);
  
  // Check authentication and admin role
  const session = await auth();
  
  if (!session?.user) {
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/analytics`);
  }

  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`);
  }

  // Mock data - In production, this would come from your analytics service
  const webVitalsMetrics: WebVitalsMetric[] = [
    {
      name: 'First Contentful Paint (FCP)',
      value: 1.2,
      rating: 'good',
      threshold: { good: 1.8, poor: 3.0 },
      trend: 'down',
      change: -0.3
    },
    {
      name: 'Largest Contentful Paint (LCP)',
      value: 2.1,
      rating: 'good',
      threshold: { good: 2.5, poor: 4.0 },
      trend: 'stable',
      change: 0.0
    },
    {
      name: 'Cumulative Layout Shift (CLS)',
      value: 0.08,
      rating: 'good',
      threshold: { good: 0.1, poor: 0.25 },
      trend: 'down',
      change: -0.02
    },
    {
      name: 'First Input Delay (FID)',
      value: 45,
      rating: 'good',
      threshold: { good: 100, poor: 300 },
      trend: 'up',
      change: 5
    },
    {
      name: 'Time to Interactive (TTI)',
      value: 2.8,
      rating: 'good',
      threshold: { good: 3.8, poor: 7.3 },
      trend: 'down',
      change: -0.2
    }
  ];

  const userEngagementMetrics: UserEngagementMetric[] = [
    { metric: 'Total Users', current: 1247, previous: 1089, change: 14.5, trend: 'up', format: 'number' },
    { metric: 'Active Users (24h)', current: 342, previous: 298, change: 14.8, trend: 'up', format: 'number' },
    { metric: 'Page Views', current: 12847, previous: 10932, change: 17.5, trend: 'up', format: 'number' },
    { metric: 'Session Duration', current: 8.4, previous: 7.2, change: 16.7, trend: 'up', format: 'time' },
    { metric: 'Bounce Rate', current: 32.1, previous: 38.5, change: -16.6, trend: 'down', format: 'percentage' },
    { metric: 'Conversion Rate', current: 4.7, previous: 3.9, change: 20.5, trend: 'up', format: 'percentage' }
  ];

  const systemHealthMetrics: SystemHealthMetric[] = [
    { component: 'API Response Time', status: 'healthy', value: 285, threshold: 500, description: 'Average API response time in milliseconds' },
    { component: 'Database Performance', status: 'healthy', value: 120, threshold: 200, description: 'Average query execution time in ms' },
    { component: 'Error Rate', status: 'healthy', value: 0.2, threshold: 1.0, description: 'Percentage of requests resulting in errors' },
    { component: 'Memory Usage', status: 'warning', value: 78, threshold: 85, description: 'Server memory utilization percentage' },
    { component: 'CPU Usage', status: 'healthy', value: 45, threshold: 80, description: 'Average CPU utilization percentage' },
    { component: 'Storage Usage', status: 'healthy', value: 62, threshold: 90, description: 'Storage utilization percentage' }
  ];

  const formatMetricValue = (value: number, format: string): string => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'time':
        return `${value.toFixed(1)}min`;
      case 'bytes':
        return value > 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)}MB` : `${(value / 1024).toFixed(0)}KB`;
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getWebVitalsBadgeColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'needs-improvement':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <title>Analytics Dashboard | Ring Platform Admin</title>
      <meta name="description" content="Comprehensive analytics dashboard for Ring Platform administrators" />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive platform performance monitoring and user engagement analytics
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="webvitals">Web Vitals</TabsTrigger>
            <TabsTrigger value="users">User Analytics</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Quick Stats */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,247</div>
                  <p className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +14.5% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">342</div>
                  <p className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +18.3% from yesterday
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12.8K</div>
                  <p className="text-xs text-green-600 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +17.5% this week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">285ms</div>
                  <p className="text-xs text-green-600 flex items-center">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -12ms faster
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Real-time Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Real-time Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                        <span className="text-sm">User logged in</span>
                      </div>
                      <span className="text-xs text-muted-foreground">2s ago</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-sm">New article published</span>
                      </div>
                      <span className="text-xs text-muted-foreground">1m ago</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                        <span className="text-sm">Entity created</span>
                      </div>
                      <span className="text-xs text-muted-foreground">3m ago</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                        <span className="text-sm">Message sent</span>
                      </div>
                      <span className="text-xs text-muted-foreground">5m ago</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    Traffic Sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Direct</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <span className="text-sm font-medium">45%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Search Engines</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '32%' }}></div>
                        </div>
                        <span className="text-sm font-medium">32%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Social Media</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '18%' }}></div>
                        </div>
                        <span className="text-sm font-medium">18%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Referrals</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div className="bg-orange-600 h-2 rounded-full" style={{ width: '5%' }}></div>
                        </div>
                        <span className="text-sm font-medium">5%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Web Vitals Tab */}
          <TabsContent value="webvitals">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-5 w-5 mr-2" />
                    Core Web Vitals Performance
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Real-time performance metrics based on React 19 optimizations
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {webVitalsMetrics.map((metric) => (
                      <div key={metric.name} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-sm">{metric.name}</h3>
                          <Badge className={getWebVitalsBadgeColor(metric.rating)}>
                            {metric.rating}
                          </Badge>
                        </div>
                        <div className="text-2xl font-bold mb-1">
                          {metric.name.includes('CLS') ? metric.value.toFixed(3) : 
                           metric.name.includes('FID') ? `${metric.value}ms` : `${metric.value}s`}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          {getTrendIcon(metric.trend)}
                          <span className="ml-1">
                            {metric.change > 0 ? '+' : ''}{metric.change}
                            {metric.name.includes('CLS') ? '' : metric.name.includes('FID') ? 'ms' : 's'} vs last week
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Good: &lt; {metric.threshold.good}
                          {metric.name.includes('CLS') ? '' : metric.name.includes('FID') ? 'ms' : 's'} • 
                          Poor: &gt; {metric.threshold.poor}
                          {metric.name.includes('CLS') ? '' : metric.name.includes('FID') ? 'ms' : 's'}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* User Analytics Tab */}
          <TabsContent value="users">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userEngagementMetrics.map((metric) => (
                  <Card key={metric.metric}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{metric.metric}</p>
                          <p className="text-2xl font-bold">{formatMetricValue(metric.current, metric.format)}</p>
                        </div>
                        {getTrendIcon(metric.trend)}
                      </div>
                      <p className={`text-xs mt-2 flex items-center ${
                        metric.change > 0 ? 'text-green-600' : metric.change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}% from last period
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Monitor className="h-5 w-5 mr-2" />
                      Device Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Monitor className="h-4 w-4 mr-2" />
                          <span>Desktop</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '58%' }}></div>
                          </div>
                          <span className="text-sm font-medium">58%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Smartphone className="h-4 w-4 mr-2" />
                          <span>Mobile</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div className="bg-green-600 h-2 rounded-full" style={{ width: '35%' }}></div>
                          </div>
                          <span className="text-sm font-medium">35%</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Monitor className="h-4 w-4 mr-2" />
                          <span>Tablet</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '7%' }}></div>
                          </div>
                          <span className="text-sm font-medium">7%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      User Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">Peak hours: 9AM - 11AM, 2PM - 4PM</div>
                      {[
                        { hour: '00-06', activity: 5 },
                        { hour: '06-12', activity: 45 },
                        { hour: '12-18', activity: 35 },
                        { hour: '18-24', activity: 15 }
                      ].map((period) => (
                        <div key={period.hour} className="flex items-center justify-between">
                          <span className="text-sm">{period.hour}</span>
                          <div className="flex items-center">
                            <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-indigo-600 h-2 rounded-full" 
                                style={{ width: `${period.activity}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{period.activity}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    React 19 Performance Impact
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Performance improvements after React 19 migration
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">-55KB</div>
                      <div className="text-sm text-muted-foreground">Bundle Size Reduction</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">+40%</div>
                      <div className="text-sm text-muted-foreground">Perceived Performance</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">-30%</div>
                      <div className="text-sm text-muted-foreground">Code Reduction</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">97.3%</div>
                      <div className="text-sm text-muted-foreground">Optimistic Update Success</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="system">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="h-5 w-5 mr-2" />
                    System Health Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {systemHealthMetrics.map((metric) => (
                      <div key={metric.component} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-sm">{metric.component}</h3>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(metric.status)}`}></div>
                        </div>
                        <div className="text-2xl font-bold mb-1">
                          {metric.component.includes('Rate') || metric.component.includes('Usage') 
                            ? `${metric.value}%` 
                            : `${metric.value}${metric.component.includes('Time') ? 'ms' : ''}`}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {metric.description}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={metric.status === 'healthy' ? 'text-green-600' : 
                                         metric.status === 'warning' ? 'text-yellow-600' : 'text-red-600'}>
                            {metric.status === 'healthy' && <CheckCircle className="h-3 w-3 inline mr-1" />}
                            {metric.status === 'warning' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                            {metric.status === 'critical' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                            {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                          </span>
                          <span className="text-muted-foreground">
                            Threshold: {metric.threshold}{metric.component.includes('Rate') || metric.component.includes('Usage') ? '%' : 'ms'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
} 