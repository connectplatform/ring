/**
 * Match Quality Badge Component
 *
 * Displays match scores and factors breakdown with visual quality indicators.
 * Used in opportunity cards, notifications, and user match displays.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Users,
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Heart,
  Zap,
  Award,
  Target,
  Eye
} from 'lucide-react';
import type { MatchFactors, UserMatch } from '@/lib/ai/types';

interface MatchQualityBadgeProps {
  /** Overall match score (0-100) */
  score: number;
  /** Detailed match factors */
  factors?: MatchFactors;
  /** Match explanation */
  explanation?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show detailed breakdown on hover/click */
  showDetailed?: boolean;
  /** Custom className */
  className?: string;
}

interface FactorDisplay {
  key: keyof MatchFactors;
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  weight: number;
}

const MatchQualityBadge: React.FC<MatchQualityBadgeProps> = ({
  score,
  factors,
  explanation,
  size = 'md',
  showDetailed = true,
  className = ''
}) => {
  const t = useTranslations('modules.opportunities.matchQuality');

  const [showTooltip, setShowTooltip] = useState(false);
  const [showDetailedCard, setShowDetailedCard] = useState(false);

  // Get quality level and styling
  const getQualityLevel = (score: number) => {
    if (score >= 80) return { level: 'excellent', color: 'text-green-600 bg-green-50 border-green-200' };
    if (score >= 70) return { level: 'good', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (score >= 60) return { level: 'fair', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { level: 'poor', color: 'text-red-600 bg-red-50 border-red-200' };
  };

  // Get score icon
  const getScoreIcon = (score: number) => {
    if (score >= 80) return <Award className="w-3 h-3" />;
    if (score >= 70) return <TrendingUp className="w-3 h-3" />;
    if (score >= 60) return <Minus className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  // Factor display configuration
  const factorDisplays: FactorDisplay[] = [
    {
      key: 'skillMatch',
      label: t('factors.skillMatch'),
      icon: Users,
      color: 'text-blue-600',
      weight: 25
    },
    {
      key: 'experienceMatch',
      label: t('factors.experienceMatch'),
      icon: TrendingUp,
      color: 'text-green-600',
      weight: 20
    },
    {
      key: 'industryMatch',
      label: t('factors.industryMatch'),
      icon: Briefcase,
      color: 'text-purple-600',
      weight: 15
    },
    {
      key: 'locationMatch',
      label: t('factors.locationMatch'),
      icon: MapPin,
      color: 'text-orange-600',
      weight: 10
    },
    {
      key: 'budgetMatch',
      label: t('factors.budgetMatch'),
      icon: DollarSign,
      color: 'text-yellow-600',
      weight: 10
    },
    {
      key: 'availabilityMatch',
      label: t('factors.availabilityMatch'),
      icon: Clock,
      color: 'text-cyan-600',
      weight: 10
    },
    {
      key: 'careerMatch',
      label: t('factors.careerMatch'),
      icon: Target,
      color: 'text-pink-600',
      weight: 5
    },
    {
      key: 'cultureMatch',
      label: t('factors.cultureMatch'),
      icon: Heart,
      color: 'text-red-600',
      weight: 5
    }
  ];

  const quality = getQualityLevel(score);
  const scoreIcon = getScoreIcon(score);

  // Size configurations
  const sizeConfig = {
    sm: {
      badge: 'px-2 py-1 text-xs',
      icon: 'w-3 h-3',
      progress: 'h-1'
    },
    md: {
      badge: 'px-3 py-1.5 text-sm',
      icon: 'w-4 h-4',
      progress: 'h-2'
    },
    lg: {
      badge: 'px-4 py-2 text-base',
      icon: 'w-5 h-5',
      progress: 'h-3'
    }
  };

  const config = sizeConfig[size];

  // Render detailed breakdown card
  const renderDetailedBreakdown = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute z-50 mt-2 w-80"
    >
      <Card className="shadow-lg border-2">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <Target className="w-4 h-4" />
              {t('detailedBreakdown')}
            </h4>
            <Badge variant="outline" className={`${quality.color} border-current`}>
              {scoreIcon}
              {score}/100
            </Badge>
          </div>

          {explanation && (
            <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
              <p className="font-medium mb-1">{t('explanation')}:</p>
              <p>{explanation}</p>
            </div>
          )}

          <div className="space-y-3">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {t('factorsBreakdown')}
            </h5>

            {factorDisplays.map((factor) => {
              const factorScore = factors?.[factor.key] || 0;
              const Icon = factor.icon;

              return (
                <div key={factor.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${factor.color}`} />
                      <span>{factor.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({factor.weight}%)</span>
                      <span className="font-medium">{factorScore}/100</span>
                    </div>
                  </div>
                  <Progress
                    value={factorScore}
                    className={`h-2 ${config.progress}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 pt-2 border-t">
            {t('scoringNote')}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // Main badge component
  const badge = (
    <div
      className={`${config.badge} ${quality.color} border-current cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border px-2.5 py-0.5 ${className}`}
      onClick={() => showDetailed && setShowDetailedCard(!showDetailedCard)}
    >
      <div className="flex items-center gap-2">
        {scoreIcon}
        <span className="font-medium">{score}</span>
        <span className="text-xs opacity-75">/100</span>
      </div>
    </div>
  );

  if (!showDetailed) {
    return badge;
  }

  return (
    <TooltipProvider>
      <div className="relative inline-block">
        <Tooltip open={showTooltip && !showDetailedCard} onOpenChange={setShowTooltip}>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t('matchScore')}</span>
                <Badge variant="outline" className={`${quality.color} text-xs px-2.5 py-0.5`}>
                  {t('levels.' + quality.level)}
                </Badge>
              </div>
              {explanation && (
                <p className="text-sm text-muted-foreground">{explanation}</p>
              )}
              <p className="text-xs text-gray-500">
                {t('clickForDetails')}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>

        <AnimatePresence>
          {showDetailedCard && renderDetailedBreakdown()}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

// Export additional components for specialized use cases

/**
 * Compact match indicator for lists and cards
 */
export const MatchIndicator: React.FC<{
  score: number;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ score, size = 'sm', className = '' }) => {
  const getIndicatorColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const sizeConfig = {
    sm: 'w-2 h-6',
    md: 'w-3 h-8'
  };

  return (
    <div className={`rounded-full ${getIndicatorColor(score)} ${sizeConfig[size]} ${className}`}
         title={`${score}/100 match score`} />
  );
};

/**
 * Match quality stars display
 */
export const MatchStars: React.FC<{
  score: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ score, maxStars = 5, size = 'md', className = '' }) => {
  const filledStars = Math.round((score / 100) * maxStars);
  const starSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={`${starSize} ${
            i < filledStars
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300'
          }`}
        />
      ))}
                <span className="ml-1 text-xs text-muted-foreground">{score}</span>
    </div>
  );
};

/**
 * Match confidence meter
 */
export const MatchConfidenceMeter: React.FC<{
  confidence: number;
  label?: string;
  className?: string;
}> = ({ confidence, label, className = '' }) => {
  const t = useTranslations('modules.opportunities.matchQuality');

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
            <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{Math.round(confidence * 100)}%</span>
        </div>
      )}
      <Progress
        value={confidence * 100}
        className="h-2"
      />
      <div className="text-xs text-gray-500">
        {confidence >= 0.8 ? t('confidence.high') :
         confidence >= 0.6 ? t('confidence.medium') :
         t('confidence.low')}
      </div>
    </div>
  );
};

export default MatchQualityBadge;
