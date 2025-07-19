// Admin Analytics Types
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: { good: number; poor: number };
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export interface UserEngagementMetric {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  format: 'number' | 'percentage' | 'time' | 'bytes';
}

export interface SystemHealthMetric {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  value: number;
  threshold: number;
  description: string;
}

export interface AnalyticsActivity {
  type: 'user_action' | 'system_event' | 'performance_metric';
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

export interface TrafficSource {
  source: string;
  percentage: number;
  sessions: number;
  change: number;
}

export interface DeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet';
  percentage: number;
  sessions: number;
}

// Content Moderation Types
export interface ModerationItem {
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

export interface ModerationStats {
  totalReports: number;
  pendingReviews: number;
  resolvedToday: number;
  autoBlocked: number;
  falsePositives: number;
  accuracyRate: number;
}

export interface AutoModerationRule {
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

export interface UserReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'content' | 'message';
  targetId: string;
  reason: 'harassment' | 'spam' | 'inappropriate' | 'violence' | 'other';
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Security Types
export interface SecurityEvent {
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

export interface SecurityMetric {
  name: string;
  value: number | string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface PermissionAudit {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  lastAccess: string;
  riskLevel: 'low' | 'medium' | 'high';
  anomalousActivity: boolean;
}

export interface SecurityRule {
  id: string;
  name: string;
  type: 'authentication' | 'authorization' | 'data_protection' | 'network' | 'monitoring';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface GeographicDistribution {
  country: string;
  sessions: number;
  percentage: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SecurityCompliance {
  standard: 'GDPR' | 'ISO_27001' | 'SOC_2' | 'PCI_DSS';
  status: 'compliant' | 'non_compliant' | 'under_review';
  lastAudit: string;
  nextAudit: string;
  score: number;
}

export interface SecurityReport {
  id: string;
  name: string;
  type: 'incident' | 'audit' | 'compliance' | 'vulnerability';
  description: string;
  generatedAt: string;
  period: string;
  format: 'pdf' | 'csv' | 'json';
  size: number;
}

// General Admin Types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'moderator' | 'security_officer';
  permissions: string[];
  lastLogin: string;
  isActive: boolean;
  createdAt: string;
}

export interface SystemStatus {
  component: 'database' | 'api' | 'storage' | 'messaging' | 'auth' | 'monitoring';
  status: 'operational' | 'degraded' | 'outage';
  uptime: number;
  responseTime: number;
  lastIncident?: string;
}

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalContent: number;
  systemLoad: number;
  storageUsage: number;
  bandwidthUsage: number;
}

// API Response Types
export interface AdminAnalyticsResponse {
  webVitals: WebVitalsMetric[];
  userEngagement: UserEngagementMetric[];
  systemHealth: SystemHealthMetric[];
  trafficSources: TrafficSource[];
  deviceBreakdown: DeviceBreakdown[];
  recentActivity: AnalyticsActivity[];
}

export interface ModerationResponse {
  stats: ModerationStats;
  items: ModerationItem[];
  rules: AutoModerationRule[];
  reports: UserReport[];
}

export interface SecurityResponse {
  metrics: SecurityMetric[];
  events: SecurityEvent[];
  permissionAudits: PermissionAudit[];
  rules: SecurityRule[];
  geographic: GeographicDistribution[];
  compliance: SecurityCompliance[];
} 