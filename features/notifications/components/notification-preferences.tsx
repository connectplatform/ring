/**
 * Notification Preferences Component
 * Comprehensive dashboard for managing all notification settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare,
  Clock,
  Globe,
  Shield,
  Settings,
  Save,
  RefreshCw,
  Check,
  X,
  Info,
  AlertTriangle,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Loader2
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationType, DetailedNotificationPreferences } from '@/features/notifications/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface NotificationPreferencesProps {
  className?: string;
}

const notificationTypeGroups = {
  'Opportunities': [
    NotificationType.OPPORTUNITY_CREATED,
    NotificationType.OPPORTUNITY_UPDATED,
    NotificationType.OPPORTUNITY_EXPIRED,
    NotificationType.OPPORTUNITY_SAVED,
    NotificationType.OPPORTUNITY_APPLIED
  ],
  'Entities': [
    NotificationType.ENTITY_CREATED,
    NotificationType.ENTITY_UPDATED,
    NotificationType.ENTITY_VERIFIED,
    NotificationType.ENTITY_REJECTED
  ],
  'Account & Security': [
    NotificationType.ACCOUNT_VERIFICATION,
    NotificationType.ROLE_UPGRADE_REQUEST,
    NotificationType.ROLE_UPGRADE_APPROVED,
    NotificationType.ROLE_UPGRADE_REJECTED,
    NotificationType.PROFILE_UPDATE,
    NotificationType.SECURITY_ALERT
  ],
  'Wallet & Transactions': [
    NotificationType.WALLET_CREATED,
    NotificationType.WALLET_TRANSACTION,
    NotificationType.WALLET_BALANCE_LOW
  ],
  'System': [
    NotificationType.SYSTEM_MAINTENANCE,
    NotificationType.SYSTEM_UPDATE
  ],
  'Social': [
    NotificationType.MESSAGE_RECEIVED,
    NotificationType.MENTION_RECEIVED,
    NotificationType.FOLLOW_REQUEST
  ],
  'KYC & Verification': [
    NotificationType.KYC_REQUIRED,
    NotificationType.KYC_APPROVED,
    NotificationType.KYC_REJECTED,
    NotificationType.KYC_EXPIRING
  ]
};

const typeLabels = {
  [NotificationType.OPPORTUNITY_CREATED]: 'New opportunities matching your criteria',
  [NotificationType.OPPORTUNITY_UPDATED]: 'Updates to opportunities you\'ve saved',
  [NotificationType.OPPORTUNITY_EXPIRED]: 'Opportunity expiration alerts',
  [NotificationType.OPPORTUNITY_SAVED]: 'Confirmation when you save opportunities',
  [NotificationType.OPPORTUNITY_APPLIED]: 'Application status updates',
  [NotificationType.ENTITY_CREATED]: 'New entity registrations',
  [NotificationType.ENTITY_UPDATED]: 'Entity profile updates',
  [NotificationType.ENTITY_VERIFIED]: 'Entity verification status changes',
  [NotificationType.ENTITY_REJECTED]: 'Entity rejection notifications',
  [NotificationType.ACCOUNT_VERIFICATION]: 'Account verification status',
  [NotificationType.ROLE_UPGRADE_REQUEST]: 'Role upgrade requests',
  [NotificationType.ROLE_UPGRADE_APPROVED]: 'Role upgrade approvals',
  [NotificationType.ROLE_UPGRADE_REJECTED]: 'Role upgrade rejections',
  [NotificationType.PROFILE_UPDATE]: 'Profile update confirmations',
  [NotificationType.SECURITY_ALERT]: 'Security alerts and login notifications',
  [NotificationType.WALLET_CREATED]: 'Wallet creation confirmations',
  [NotificationType.WALLET_TRANSACTION]: 'Transaction confirmations',
  [NotificationType.WALLET_BALANCE_LOW]: 'Low balance alerts',
  [NotificationType.SYSTEM_MAINTENANCE]: 'Maintenance notifications',
  [NotificationType.SYSTEM_UPDATE]: 'System updates and new features',
  [NotificationType.MESSAGE_RECEIVED]: 'New messages',
  [NotificationType.MENTION_RECEIVED]: 'When you\'re mentioned',
  [NotificationType.FOLLOW_REQUEST]: 'New follow requests',
  [NotificationType.KYC_REQUIRED]: 'KYC verification required',
  [NotificationType.KYC_APPROVED]: 'KYC verification approved',
  [NotificationType.KYC_REJECTED]: 'KYC verification rejected',
  [NotificationType.KYC_EXPIRING]: 'KYC expiration warnings'
};

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const { preferences, updatePreferences, updatingPreferences, fetchPreferences } = useNotifications();
  
  const [localPreferences, setLocalPreferences] = useState<Partial<DetailedNotificationPreferences>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize local preferences when data loads
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Track changes
  useEffect(() => {
    if (preferences) {
      const hasChanges = JSON.stringify(localPreferences) !== JSON.stringify(preferences);
      setHasChanges(hasChanges);
    }
  }, [localPreferences, preferences]);

  const updateLocalPreference = (path: string, value: any) => {
    setLocalPreferences(prev => {
      const keys = path.split('.');
      const newPrefs = { ...prev };
      let current: any = newPrefs;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newPrefs;
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      const success = await updatePreferences(localPreferences);
      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  };

  if (!preferences || !localPreferences.enabled !== undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin mr-3" />
        <span>Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Notification Preferences
          </h2>
          <p className="text-muted-foreground mt-1">
            Customize how and when you receive notifications
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <X className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
          
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="w-5 h-5 mr-2" />
            Master Control
          </CardTitle>
          <CardDescription>
            Enable or disable all notifications globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="master-toggle" className="text-base font-medium">
                Enable Notifications
              </Label>
                <p className="text-sm text-muted-foreground mt-1">
                Turn off to stop receiving all notifications
              </p>
            </div>
            <Switch
              id="master-toggle"
              checked={localPreferences.enabled || false}
              onCheckedChange={(checked) => updateLocalPreference('enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Delivery Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Delivery Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In-App Notifications */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-blue-500" />
                <div>
                  <Label className="text-base font-medium">In-App</Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications within the platform
                  </p>
                  <Badge variant="default" className="mt-1">Available</Badge>
                </div>
              </div>
              <Switch
                checked={localPreferences.channels?.inApp || false}
                onCheckedChange={(checked) => updateLocalPreference('channels.inApp', checked)}
                disabled={!localPreferences.enabled}
              />
            </div>

            {/* Email Notifications */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-green-500" />
                <div>
                  <Label className="text-base font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Rich HTML email notifications
                  </p>
                  <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                </div>
              </div>
              <Switch
                checked={localPreferences.channels?.email || false}
                onCheckedChange={(checked) => updateLocalPreference('channels.email', checked)}
                disabled={!localPreferences.enabled}
              />
            </div>

            {/* SMS Notifications */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-orange-500" />
                <div>
                  <Label className="text-base font-medium">SMS</Label>
                  <p className="text-sm text-muted-foreground">
                    Critical alerts via text message
                  </p>
                  <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                </div>
              </div>
              <Switch
                checked={localPreferences.channels?.sms || false}
                onCheckedChange={(checked) => updateLocalPreference('channels.sms', checked)}
                disabled={!localPreferences.enabled}
              />
            </div>

            {/* Push Notifications */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-5 h-5 text-purple-500" />
                <div>
                  <Label className="text-base font-medium">Push</Label>
                  <p className="text-sm text-muted-foreground">
                    Browser and mobile push notifications
                  </p>
                  <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                </div>
              </div>
              <Switch
                checked={localPreferences.channels?.push || false}
                onCheckedChange={(checked) => updateLocalPreference('channels.push', checked)}
                disabled={!localPreferences.enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Notification Types
          </CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(notificationTypeGroups).map(([groupName, types]) => (
            <div key={groupName}>
              <h4 className="font-medium text-foreground mb-3">
                {groupName}
              </h4>
              <div className="space-y-3">
                {types.map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {typeLabels[type]}
                      </p>
                    </div>
                    <Switch
                      checked={localPreferences.types?.[type] !== false}
                      onCheckedChange={(checked) => updateLocalPreference(`types.${type}`, checked)}
                      disabled={!localPreferences.enabled}
                    />
                  </div>
                ))}
              </div>
              {groupName !== 'KYC & Verification' && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Moon className="w-5 h-5 mr-2" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set times when you don't want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable Quiet Hours</Label>
                <p className="text-sm text-muted-foreground mt-1">
                Notifications will be queued during these hours
              </p>
            </div>
            <Switch
              checked={localPreferences.quietHours?.enabled || false}
              onCheckedChange={(checked) => updateLocalPreference('quietHours.enabled', checked)}
              disabled={!localPreferences.enabled}
            />
          </div>

          {localPreferences.quietHours?.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={localPreferences.quietHours?.startTime || '22:00'}
                  onChange={(e) => updateLocalPreference('quietHours.startTime', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={localPreferences.quietHours?.endTime || '08:00'}
                  onChange={(e) => updateLocalPreference('quietHours.endTime', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Language & Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Language & Region
          </CardTitle>
          <CardDescription>
            Set your preferred language and timezone for notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={localPreferences.language || 'en'}
                onValueChange={(value) => updateLocalPreference('language', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={localPreferences.quietHours?.timezone || 'UTC'}
                onValueChange={(value) => updateLocalPreference('quietHours.timezone', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/Kiev">Europe/Kiev</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Status */}
      {saveStatus === 'error' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">
              Failed to save preferences. Please try again.
            </span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">About Notification Preferences</p>
            <ul className="space-y-1 text-xs">
              <li>• Changes are saved automatically when you click "Save Changes"</li>
              <li>• Some delivery channels are coming soon and will be enabled when available</li>
              <li>• Security alerts cannot be disabled for your account safety</li>
              <li>• Quiet hours apply to all channels except urgent security notifications</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 