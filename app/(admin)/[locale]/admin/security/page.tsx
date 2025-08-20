import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Eye, 
  KeyRound, 
  Globe, 
  User, 
  Server, 
  Database, 
  Wifi, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  UserCheck,
  FileText,
  Settings
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// Types for security system
interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'failed_login' | 'permission_change' | 'data_access' | 'security_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user?: {
    id: string;
    email: string;
    role: string;
    ip: string;
  };
  details: string;
  timestamp: string;
  location?: string;
  device?: string;
  status: 'resolved' | 'investigating' | 'open';
}

interface SecurityMetric {
  name: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  description: string;
}

interface PermissionAudit {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  lastAccess: string;
  riskLevel: 'low' | 'medium' | 'high';
  anomalousActivity: boolean;
}

interface SecurityRule {
  id: string;
  name: string;
  type: 'authentication' | 'authorization' | 'data_protection' | 'network' | 'monitoring';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  lastTriggered?: string;
  triggerCount: number;
}

export default async function SecurityPage({ 
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
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/security`);
  }

  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`);
  }

  // Mock data - In production, this would come from your security monitoring service
  const securityMetrics: SecurityMetric[] = [
    {
      name: 'Failed Login Attempts',
      value: 23,
      change: -15.3,
      trend: 'down',
      status: 'good',
      description: 'Failed authentication attempts in the last 24 hours'
    },
    {
      name: 'Active Sessions',
      value: 342,
      change: 12.5,
      trend: 'up',
      status: 'good',
      description: 'Currently active user sessions'
    },
    {
      name: 'Permission Violations',
      value: 2,
      change: 0,
      trend: 'stable',
      status: 'good',
      description: 'Unauthorized access attempts'
    },
    {
      name: 'Security Score',
      value: '94.5%',
      change: 2.1,
      trend: 'up',
      status: 'good',
      description: 'Overall platform security rating'
    },
    {
      name: 'Data Breaches',
      value: 0,
      change: 0,
      trend: 'stable',
      status: 'good',
      description: 'Confirmed data security incidents'
    },
    {
      name: 'Suspicious IPs',
      value: 12,
      change: -8.2,
      trend: 'down',
      status: 'warning',
      description: 'IP addresses flagged for suspicious activity'
    }
  ];

  const securityEvents: SecurityEvent[] = [
    {
      id: '1',
      type: 'failed_login',
      severity: 'medium',
      user: {
        id: 'unknown',
        email: 'attacker@malicious.com',
        role: 'unknown',
        ip: '192.168.1.100'
      },
      details: 'Multiple failed login attempts detected from suspicious IP address',
      timestamp: '2025-01-24T14:30:00Z',
      location: 'Unknown Location',
      device: 'Chrome/Linux',
      status: 'investigating'
    },
    {
      id: '2',
      type: 'permission_change',
      severity: 'high',
      user: {
        id: 'admin1',
        email: 'admin@ring.ck.ua',
        role: 'admin',
        ip: '10.0.0.1'
      },
      details: 'User role elevated to admin level for user@example.com',
      timestamp: '2025-01-24T13:15:00Z',
      location: 'Kyiv, Ukraine',
      device: 'Safari/macOS',
      status: 'resolved'
    },
    {
      id: '3',
      type: 'data_access',
      severity: 'low',
      user: {
        id: 'user123',
        email: 'user@example.com',
        role: 'member',
        ip: '192.168.1.50'
      },
      details: 'Bulk data export performed - 500 entity records',
      timestamp: '2025-01-24T12:45:00Z',
      location: 'Lviv, Ukraine',
      device: 'Firefox/Windows',
      status: 'open'
    }
  ];

  const permissionAudits: PermissionAudit[] = [
    {
      userId: 'admin1',
      email: 'admin@ring.ck.ua',
      role: 'admin',
      permissions: ['read_all', 'write_all', 'delete_all', 'manage_users', 'system_config'],
      lastAccess: '2025-01-24T14:30:00Z',
      riskLevel: 'low',
      anomalousActivity: false
    },
    {
      userId: 'user123',
      email: 'suspicious@example.com',
      role: 'member',
      permissions: ['read_entities', 'create_opportunities', 'message_users'],
      lastAccess: '2025-01-24T10:15:00Z',
      riskLevel: 'high',
      anomalousActivity: true
    }
  ];

  const securityRules: SecurityRule[] = [
    {
      id: '1',
      name: 'Brute Force Protection',
      type: 'authentication',
      enabled: true,
      severity: 'high',
      description: 'Blocks IP addresses after 5 failed login attempts within 15 minutes',
      lastTriggered: '2025-01-24T14:30:00Z',
      triggerCount: 12
    },
    {
      id: '2',
      name: 'Anomalous Data Access',
      type: 'monitoring',
      enabled: true,
      severity: 'medium',
      description: 'Detects unusual patterns in data access and bulk operations',
      lastTriggered: '2025-01-24T12:45:00Z',
      triggerCount: 3
    },
    {
      id: '3',
      name: 'Privilege Escalation Detection',
      type: 'authorization',
      enabled: true,
      severity: 'critical',
      description: 'Monitors and alerts on permission changes and role elevations',
      lastTriggered: '2025-01-24T13:15:00Z',
      triggerCount: 1
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'open':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <User className="h-4 w-4 text-green-600" />;
      case 'logout':
        return <User className="h-4 w-4 text-gray-600" />;
      case 'failed_login':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'permission_change':
        return <KeyRound className="h-4 w-4 text-yellow-600" />;
      case 'data_access':
        return <Database className="h-4 w-4 text-blue-600" />;
      case 'security_violation':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <title>Security Dashboard | Ring Platform Admin</title>
      <meta name="description" content="Advanced security monitoring and audit dashboard for Ring Platform administrators" />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Security Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Advanced security monitoring, authentication tracking, and permission auditing
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Security Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {securityMetrics.map((metric) => (
            <Card key={metric.name}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    {getTrendIcon(metric.trend)}
                    <div className={`text-xs mt-1 ${
                      metric.change > 0 ? 'text-green-600' : metric.change < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {metric.change > 0 ? '+' : ''}{metric.change}%
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                    metric.status === 'good' ? 'bg-green-100 text-green-800' :
                    metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {metric.status === 'good' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {metric.status === 'warning' && <AlertCircle className="h-3 w-3 mr-1" />}
                    {metric.status === 'critical' && <XCircle className="h-3 w-3 mr-1" />}
                    {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="events">Security Events</TabsTrigger>
            <TabsTrigger value="permissions">Permission Audit</TabsTrigger>
            <TabsTrigger value="rules">Security Rules</TabsTrigger>
            <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
            <TabsTrigger value="reports">Security Reports</TabsTrigger>
          </TabsList>

          {/* Security Events Tab */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Recent Security Events
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {securityEvents.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getEventTypeIcon(event.type)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge className={getSeverityColor(event.severity)}>
                                {event.severity}
                              </Badge>
                              <Badge className={getStatusColor(event.status)}>
                                {event.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {event.type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                              {event.details}
                            </p>
                            
                            {event.user && (
                              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground mb-2">
                                <div>
                                  <strong>User:</strong> {event.user.email} ({event.user.role})
                                </div>
                                <div>
                                  <strong>IP:</strong> {event.user.ip}
                                </div>
                                {event.location && (
                                  <div>
                                    <strong>Location:</strong> {event.location}
                                  </div>
                                )}
                                {event.device && (
                                  <div>
                                    <strong>Device:</strong> {event.device}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDate(event.timestamp)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <Button size="sm" variant="outline">
                            Investigate
                          </Button>
                          <Button size="sm" variant="outline">
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permission Audit Tab */}
          <TabsContent value="permissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <KeyRound className="h-5 w-5 mr-2" />
                  User Permission Audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {permissionAudits.map((audit) => (
                    <div key={audit.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <UserCheck className="h-5 w-5 text-blue-600" />
                          <div>
                            <h3 className="font-medium">{audit.email}</h3>
                            <p className="text-sm text-muted-foreground">
                              Role: {audit.role} • Last Access: {formatDate(audit.lastAccess)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getRiskColor(audit.riskLevel)}>
                            {audit.riskLevel} risk
                          </Badge>
                          {audit.anomalousActivity && (
                            <Badge className="bg-orange-100 text-orange-800">
                              Anomalous Activity
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-2">Permissions:</p>
                        <div className="flex flex-wrap gap-1">
                          {audit.permissions.map((permission) => (
                            <Badge key={permission} variant="secondary" className="text-xs">
                              {permission.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          Modify Permissions
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Rules Tab */}
          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Security Rules & Policies
                  </CardTitle>
                  <Button>
                    Add New Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {securityRules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <div>
                            <h3 className="font-medium">{rule.name}</h3>
                            <p className="text-sm text-muted-foreground">{rule.type.replace('_', ' ').toUpperCase()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getSeverityColor(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          <Button size="sm" variant="outline">
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {rule.description}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span>Triggers: <strong>{rule.triggerCount}</strong></span>
                          {rule.lastTriggered && (
                            <span>Last Triggered: <strong>{formatDate(rule.lastTriggered)}</strong></span>
                          )}
                        </div>
                        <Button size="sm" variant="ghost">
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Real-time Monitoring Tab */}
          <TabsContent value="monitoring">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      Live Security Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { event: 'User logged in', user: 'john@example.com', time: '5s ago', status: 'success' },
                        { event: 'Failed login attempt', user: 'unknown', time: '23s ago', status: 'warning' },
                        { event: 'Permission granted', user: 'admin@ring.ck.ua', time: '1m ago', status: 'info' },
                        { event: 'Data export', user: 'user@example.com', time: '3m ago', status: 'info' },
                        { event: 'Security rule triggered', user: 'system', time: '5m ago', status: 'warning' }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-950">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              item.status === 'success' ? 'bg-green-500' :
                              item.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                            } animate-pulse`}></div>
                            <div>
                              <p className="text-sm font-medium">{item.event}</p>
                              <p className="text-xs text-muted-foreground">{item.user}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Globe className="h-5 w-5 mr-2" />
                      Geographic Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { country: 'Ukraine', sessions: 156, percentage: 45 },
                        { country: 'United States', sessions: 89, percentage: 26 },
                        { country: 'Poland', sessions: 67, percentage: 19 },
                        { country: 'Germany', sessions: 34, percentage: 10 }
                      ].map((location) => (
                        <div key={location.country} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{location.country}</span>
                            <span className="text-xs text-muted-foreground">({location.sessions} sessions)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${location.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium w-8">{location.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Security Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Security Reports & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold">GDPR</div>
                        <div className="text-sm text-muted-foreground">Compliant</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Lock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold">ISO 27001</div>
                        <div className="text-sm text-muted-foreground">Certified</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <CheckCircle className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold">SOC 2</div>
                        <div className="text-sm text-muted-foreground">Type II</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium">Available Reports</h3>
                    {[
                      { name: 'Security Incident Report', description: 'Detailed analysis of security events', date: 'January 2025' },
                      { name: 'Permission Audit Report', description: 'User access and permission analysis', date: 'Monthly' },
                      { name: 'Compliance Assessment', description: 'GDPR and security standards compliance', date: 'Quarterly' },
                      { name: 'Vulnerability Assessment', description: 'System security vulnerability scan', date: 'Weekly' }
                    ].map((report, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{report.name}</p>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">{report.date}</span>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
} 