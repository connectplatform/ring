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
  Globe,
  Settings,
  Save,
  Check,
  X,
  Info,
  Moon,
  Volume2,
  Loader2,
} from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useTranslations } from 'next-intl';
import { NotificationType, DetailedNotificationPreferences } from '@/features/notifications/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import TimezoneSelect from '@/components/ui/timezone-select';
import { routing } from '@/i18n/routing';
import { davinciGlassSurface } from '@/lib/ui/davinci';
import { NotificationErrorBoundary } from './notification-error-boundary';

interface NotificationPreferencesProps {
  className?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  de: 'Deutsch',
  es: 'Español',
}

const notificationTypeGroups: Array<{ id: string; types: NotificationType[] }> = [
  {
    id: 'opportunities',
    types: [
      NotificationType.OPPORTUNITY_CREATED,
      NotificationType.OPPORTUNITY_UPDATED,
      NotificationType.OPPORTUNITY_EXPIRED,
      NotificationType.OPPORTUNITY_SAVED,
      NotificationType.OPPORTUNITY_APPLIED,
      NotificationType.OPPORTUNITY_MATCHED_AI,
    ],
  },
  {
    id: 'entities',
    types: [
      NotificationType.ENTITY_CREATED,
      NotificationType.ENTITY_UPDATED,
      NotificationType.ENTITY_VERIFIED,
      NotificationType.ENTITY_REJECTED,
    ],
  },
  {
    id: 'account',
    types: [
      NotificationType.ACCOUNT_VERIFICATION,
      NotificationType.ROLE_UPGRADE_REQUEST,
      NotificationType.ROLE_UPGRADE_APPROVED,
      NotificationType.ROLE_UPGRADE_REJECTED,
      NotificationType.PROFILE_UPDATE,
      NotificationType.SECURITY_ALERT,
      NotificationType.REFERRAL_REWARD_MINTED,
    ],
  },
  {
    id: 'wallet',
    types: [
      NotificationType.WALLET_CREATED,
      NotificationType.WALLET_TRANSACTION,
      NotificationType.WALLET_BALANCE_LOW,
      NotificationType.PAYMENT_REQUEST,
      NotificationType.ENV_REQUEST,
      NotificationType.REWARD_CREDIT_RECEIVED,
    ],
  },
  {
    id: 'system',
    types: [NotificationType.SYSTEM_MAINTENANCE, NotificationType.SYSTEM_UPDATE],
  },
  {
    id: 'social',
    types: [
      NotificationType.MESSAGE_RECEIVED,
      NotificationType.MENTION_RECEIVED,
      NotificationType.FOLLOW_REQUEST,
      NotificationType.TASK_ASSIGNED,
      NotificationType.TASK_UPDATED,
      NotificationType.POLL_CREATED,
      NotificationType.POLL_CLOSED,
      NotificationType.RSVP_INVITE,
      NotificationType.RSVP_UPDATED,
      NotificationType.DAO_JAR_UPDATE,
      NotificationType.GAME_REQUEST,
      NotificationType.GAME_UPDATED,
      NotificationType.CALL_INVITE,
    ],
  },
  {
    id: 'kyc',
    types: [
      NotificationType.KYC_REQUIRED,
      NotificationType.KYC_APPROVED,
      NotificationType.KYC_REJECTED,
      NotificationType.KYC_EXPIRING,
    ],
  },
]

function PreferenceSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn(davinciGlassSurface, 'space-y-4 p-4')}>
      <div>
        <h3 className="flex items-center text-base font-semibold text-foreground">
          {icon}
          <span className="ml-2">{title}</span>
        </h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function NotificationPreferencesForm({ className }: NotificationPreferencesProps) {
  const { preferences, updatePreferences, error } = useNotifications();
  const t = useTranslations('modules.notifications.preferences')
  const tTypeLabels = useTranslations('modules.notifications.typeLabels')

  const [localPreferences, setLocalPreferences] = useState<Partial<DetailedNotificationPreferences>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const labelForType = (type: NotificationType) => tTypeLabels(type)

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

  if (!preferences) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="mr-3 h-8 w-8 animate-spin" />
        <span>{t('loading')}</span>
      </div>
    );
  }

  const channels: Array<{
    id: 'inApp' | 'email' | 'sms' | 'push'
    icon: typeof Bell
    live: boolean
  }> = [
    { id: 'inApp', icon: Bell, live: true },
    { id: 'push', icon: Volume2, live: true },
    { id: 'email', icon: Mail, live: false },
    { id: 'sms', icon: Smartphone, live: false },
  ]

  return (
    <div className={cn('w-full min-w-0 space-y-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <X className="mr-2 h-4 w-4" />
              {t('reset')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saveStatus === 'saving'}>
            {saveStatus === 'saving' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveStatus === 'saving' ? t('saving') : saveStatus === 'saved' ? t('saved') : t('save')}
          </Button>
        </div>
      </div>
      {saveStatus === 'saved' ? <p className="text-sm text-muted-foreground">{t('saved')}</p> : null}
      {saveStatus === 'error' ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error || t('saveError')}</p>
      ) : null}

      <PreferenceSection icon={<Bell className="h-5 w-5" />} title={t('masterTitle')} description={t('masterDescription')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="master-toggle" className="text-base font-medium">{t('enableLabel')}</Label>
            <p className="mt-1 text-sm text-muted-foreground">{t('enableHint')}</p>
          </div>
          <Switch
            id="master-toggle"
            checked={localPreferences.enabled || false}
            onCheckedChange={(checked) => updateLocalPreference('enabled', checked)}
          />
        </div>
      </PreferenceSection>

      <PreferenceSection icon={<MessageSquare className="h-5 w-5" />} title={t('channelsTitle')} description={t('channelsDescription')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {channels.map((channel) => {
            const Icon = channel.icon
            return (
              <div key={channel.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <Label className="text-base font-medium">{t(channel.id)}</Label>
                    <p className="text-sm text-muted-foreground">{t(`${channel.id}Hint`)}</p>
                    <Badge variant={channel.live ? 'default' : 'secondary'} className="mt-1">
                      {channel.live ? t('available') : t('comingSoon')}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={localPreferences.channels?.[channel.id] || false}
                  onCheckedChange={(checked) => updateLocalPreference(`channels.${channel.id}`, checked)}
                  disabled={!localPreferences.enabled}
                />
              </div>
            )
          })}
        </div>
      </PreferenceSection>

      <PreferenceSection icon={<Settings className="h-5 w-5" />} title={t('typesTitle')} description={t('typesDescription')}>
        <div className="space-y-6">
          {notificationTypeGroups.map((group, index) => (
            <div key={group.id}>
              <h4 className="mb-3 font-medium text-foreground">{t(`groups.${group.id}`)}</h4>
              <div className="space-y-3">
                {group.types.map((type) => (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">{labelForType(type)}</p>
                    </div>
                    <Switch
                      checked={localPreferences.types?.[type] !== false}
                      onCheckedChange={(checked) => updateLocalPreference(`types.${type}`, checked)}
                      disabled={!localPreferences.enabled}
                    />
                  </div>
                ))}
              </div>
              {index < notificationTypeGroups.length - 1 ? <Separator className="mt-4" /> : null}
            </div>
          ))}
        </div>
      </PreferenceSection>

      <PreferenceSection icon={<Moon className="h-5 w-5" />} title={t('quietTitle')} description={t('quietDescription')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-base font-medium">{t('quietEnable')}</Label>
            <p className="mt-1 text-sm text-muted-foreground">{t('quietHint')}</p>
          </div>
          <Switch
            checked={localPreferences.quietHours?.enabled || false}
            onCheckedChange={(checked) => updateLocalPreference('quietHours.enabled', checked)}
            disabled={!localPreferences.enabled}
          />
        </div>
        {localPreferences.quietHours?.enabled ? (
          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
            <div>
              <Label htmlFor="quiet-start">{t('start')}</Label>
              <Input
                id="quiet-start"
                type="time"
                value={localPreferences.quietHours?.startTime || '22:00'}
                onChange={(e) => updateLocalPreference('quietHours.startTime', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="quiet-end">{t('end')}</Label>
              <Input
                id="quiet-end"
                type="time"
                value={localPreferences.quietHours?.endTime || '08:00'}
                onChange={(e) => updateLocalPreference('quietHours.endTime', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        ) : null}
      </PreferenceSection>

      <PreferenceSection icon={<Globe className="h-5 w-5" />} title={t('regionTitle')} description={t('regionDescription')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="language">{t('language')}</Label>
            <Select
              value={localPreferences.language || 'en'}
              onValueChange={(value) => updateLocalPreference('language', value)}
            >
              <SelectTrigger id="language" className="mt-1">
                <SelectValue placeholder={t('selectLanguage')} />
              </SelectTrigger>
              <SelectContent>
                {routing.locales.map((code) => (
                  <SelectItem key={code} value={code}>
                    {LANGUAGE_LABELS[code] ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="timezone">{t('timezone')}</Label>
            <div className="mt-1">
              <TimezoneSelect
                value={localPreferences.quietHours?.timezone || 'UTC'}
                onChange={(value) => updateLocalPreference('quietHours.timezone', value)}
              />
            </div>
          </div>
        </div>
      </PreferenceSection>

      <div className={cn(davinciGlassSurface, 'p-4 text-sm text-muted-foreground')}>
        <p className="mb-1 flex items-center font-medium text-foreground">
          <Info className="mr-2 h-5 w-5" />
          {t('aboutTitle')}
        </p>
        <ul className="space-y-1 text-xs">
          <li>{t('aboutSave')}</li>
          <li>{t('aboutChannels')}</li>
          <li>{t('aboutQuiet')}</li>
        </ul>
      </div>
    </div>
  );
}

export function NotificationPreferences(props: NotificationPreferencesProps) {
  return (
    <NotificationErrorBoundary>
      <NotificationPreferencesForm {...props} />
    </NotificationErrorBoundary>
  )
} 