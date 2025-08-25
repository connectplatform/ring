import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth' 
import { isValidLocale, defaultLocale, loadTranslations } from '@/i18n-config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  EyeOff, 
  Flag, 
  Check, 
  X, 
  Clock,
  User,
  MessageSquare,
  FileText,
  Image,
  ChevronRight,
  Filter,
  Search,
  MoreHorizontal,
  Ban,
  UserCheck,
  Archive
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// Types for moderation system
interface ModerationItem {
  id: string;
  type: 'comment' | 'post' | 'user' | 'message' | 'entity';
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  reportedBy: {
    id: string;
    name: string;
    reason: string;
  }[];
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  reportedAt: string;
  autoModerationFlags: string[];
  adminNotes?: string;
}

interface ModerationStats {
  totalReports: number;
  pendingReviews: number;
  resolvedToday: number;
  autoBlocked: number;
  falsePositives: number;
  accuracyRate: number;
}

interface AutoModerationRule {
  id: string;
  name: string;
  type: 'keyword' | 'pattern' | 'sentiment' | 'spam' | 'toxicity';
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  action: 'flag' | 'block' | 'review';
  description: string;
  matches: number;
  accuracy: number;
}

export default async function ModerationPage({ 
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
    redirect(`/${validLocale}/login?callbackUrl=/${validLocale}/admin/moderation`);
  }

  if (session.user.role !== 'admin') {
    redirect(`/${validLocale}/unauthorized`);
  }

  // Mock data - In production, this would come from your moderation service
  const moderationStats: ModerationStats = {
    totalReports: 47,
    pendingReviews: 12,
    resolvedToday: 8,
    autoBlocked: 23,
    falsePositives: 2,
    accuracyRate: 94.5
  };

  const moderationItems: ModerationItem[] = [
    {
      id: '1',
      type: 'comment',
      content: 'This is an inappropriate comment that violates community guidelines...',
      author: {
        id: 'user1',
        name: 'John Doe',
        email: 'john@example.com'
      },
      reportedBy: [
        {
          id: 'reporter1',
          name: 'Jane Smith',
          reason: 'Harassment'
        }
      ],
      status: 'pending',
      priority: 'high',
      createdAt: '2025-01-24T10:30:00Z',
      reportedAt: '2025-01-24T11:15:00Z',
      autoModerationFlags: ['toxic_language', 'harassment']
    },
    {
      id: '2',
      type: 'post',
      content: 'Spam content promoting external services without permission...',
      author: {
        id: 'user2',
        name: 'Spam User',
        email: 'spam@example.com'
      },
      reportedBy: [
        {
          id: 'reporter2',
          name: 'Community Moderator',
          reason: 'Spam'
        }
      ],
      status: 'pending',
      priority: 'medium',
      createdAt: '2025-01-24T09:45:00Z',
      reportedAt: '2025-01-24T10:00:00Z',
      autoModerationFlags: ['spam_content', 'external_links']
    }
  ];

  const autoModerationRules: AutoModerationRule[] = [
    {
      id: '1',
      name: 'Toxic Language Detection',
      type: 'toxicity',
      enabled: true,
      sensitivity: 'high',
      action: 'flag',
      description: 'Detects harmful, abusive, or toxic language in content',
      matches: 156,
      accuracy: 92.3
    },
    {
      id: '2',
      name: 'Spam Content Filter',
      type: 'spam',
      enabled: true,
      sensitivity: 'medium',
      action: 'block',
      description: 'Identifies and blocks spam content and promotional material',
      matches: 89,
      accuracy: 96.7
    },
    {
      id: '3',
      name: 'Harassment Detection',
      type: 'pattern',
      enabled: true,
      sensitivity: 'high',
      action: 'review',
      description: 'Identifies patterns of harassment and bullying behavior',
      matches: 34,
      accuracy: 88.2
    },
    {
      id: '4',
      name: 'Inappropriate Keywords',
      type: 'keyword',
      enabled: true,
      sensitivity: 'medium',
      action: 'flag',
      description: 'Flags content containing inappropriate or banned keywords',
      matches: 67,
      accuracy: 94.1
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'flagged':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return MessageSquare;
      case 'post':
        return FileText;
      case 'user':
        return User;
      case 'message':
        return MessageSquare;
      case 'entity':
        return FileText;
      default:
        return FileText;
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
      <title>Content Moderation | Ring Platform Admin</title>
      <meta name="description" content="Content moderation dashboard for Ring Platform administrators" />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Content Moderation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Advanced content moderation system with automated filtering and manual review
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Flag className="h-8 w-8 text-red-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.totalReports}</p>
                  <p className="text-xs text-muted-foreground">Total Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.pendingReviews}</p>
                  <p className="text-xs text-muted-foreground">Pending Reviews</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Check className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.resolvedToday}</p>
                  <p className="text-xs text-muted-foreground">Resolved Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.autoBlocked}</p>
                  <p className="text-xs text-muted-foreground">Auto Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.falsePositives}</p>
                  <p className="text-xs text-muted-foreground">False Positives</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Eye className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">{moderationStats.accuracyRate}%</p>
                  <p className="text-xs text-muted-foreground">Accuracy Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="queue">Moderation Queue</TabsTrigger>
            <TabsTrigger value="rules">Auto-Moderation Rules</TabsTrigger>
            <TabsTrigger value="reports">User Reports</TabsTrigger>
            <TabsTrigger value="analytics">Moderation Analytics</TabsTrigger>
          </TabsList>

          {/* Moderation Queue Tab */}
          <TabsContent value="queue">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Flag className="h-5 w-5 mr-2" />
                    Content Review Queue ({moderationStats.pendingReviews} pending)
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
                  {moderationItems.map((item) => {
                    const TypeIcon = getTypeIcon(item.type);
                    return (
                      <div key={item.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(item.priority)} mt-1`}></div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                <Badge className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                                <Badge variant="outline">
                                  {item.type}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Priority: {item.priority}
                                </span>
                              </div>
                              
                              <div className="mb-3">
                                <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                                  <strong>Content:</strong> {item.content.substring(0, 150)}
                                  {item.content.length > 150 && '...'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Author:</strong> {item.author.name} ({item.author.email})
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Reported by:</strong> {item.reportedBy.map(r => r.name).join(', ')} 
                                  ({item.reportedBy.map(r => r.reason).join(', ')})
                                </p>
                              </div>

                              {item.autoModerationFlags.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-sm font-medium mb-1">Auto-moderation flags:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {item.autoModerationFlags.map((flag) => (
                                      <Badge key={flag} variant="secondary" className="text-xs">
                                        {flag.replace('_', ' ')}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center text-xs text-muted-foreground space-x-4">
                                <span>Created: {formatDate(item.createdAt)}</span>
                                <span>Reported: {formatDate(item.reportedAt)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50">
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button size="sm" variant="outline">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Moderation Rules Tab */}
          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Auto-Moderation Rules
                  </CardTitle>
                  <Button>
                    Add New Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {autoModerationRules.map((rule) => (
                    <div key={rule.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <h3 className="font-medium">{rule.name}</h3>
                          <Badge variant="outline">{rule.type}</Badge>
                          <Badge variant="secondary">{rule.sensitivity} sensitivity</Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="outline">
                            Configure
                          </Button>
                          <Button size="sm" variant="outline">
                            {rule.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {rule.description}
                      </p>
                      
                      <div className="flex items-center space-x-6 text-sm">
                        <span>Action: <strong>{rule.action}</strong></span>
                        <span>Matches: <strong>{rule.matches}</strong></span>
                        <span>Accuracy: <strong>{rule.accuracy}%</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Flag className="h-5 w-5 mr-2" />
                  User Reports & Community Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">18</div>
                          <div className="text-sm text-muted-foreground">Harassment Reports</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">12</div>
                          <div className="text-sm text-muted-foreground">Spam Reports</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">9</div>
                          <div className="text-sm text-muted-foreground">Inappropriate Content</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium">Recent Community Reports</h3>
                    {[
                      { reporter: 'Jane Doe', reason: 'Harassment', target: 'Comment by @user123', time: '2 hours ago' },
                      { reporter: 'Admin Bot', reason: 'Spam Detection', target: 'Post by @spammer', time: '4 hours ago' },
                      { reporter: 'Community', reason: 'Inappropriate Content', target: 'Entity listing', time: '6 hours ago' }
                    ].map((report, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center space-x-3">
                          <Flag className="h-4 w-4 text-red-500" />
                          <div>
                            <p className="text-sm font-medium">{report.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              Reported by {report.reporter} • {report.target}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">{report.time}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Moderation Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Moderation Efficiency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Average Resolution Time</span>
                          <span>2.3 hours</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Auto-Moderation Accuracy</span>
                          <span>94.5%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '94%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Community Satisfaction</span>
                          <span>4.6/5.0</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { category: 'Comments', count: 156, percentage: 45 },
                        { category: 'Posts', count: 89, percentage: 26 },
                        { category: 'Messages', count: 67, percentage: 19 },
                        { category: 'Entities', count: 34, percentage: 10 }
                      ].map((item) => (
                        <div key={item.category} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{item.category}</span>
                            <span className="text-xs text-muted-foreground">({item.count})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-indigo-600 h-2 rounded-full" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium w-8">{item.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
} 