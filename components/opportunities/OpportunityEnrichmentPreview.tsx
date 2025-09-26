/**
 * Opportunity Enrichment Preview Component
 *
 * Displays auto-filled fields from LLM analysis with confidence scores,
 * allowing users to accept, modify, or reject AI suggestions before publishing.
 *
 * @author Ring Platform Team
 * @version 1.0.0
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Check,
  X,
  Edit,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  DollarSign,
  MapPin,
  Clock,
  Users,
  Briefcase,
  Zap,
  Info
} from 'lucide-react';
import type { AutoFillResult, EnrichedOpportunity, OpportunityInput } from '@/lib/ai/types';

interface OpportunityEnrichmentPreviewProps {
  /** Original opportunity input before enrichment */
  originalOpportunity: OpportunityInput;
  /** Auto-fill analysis result from LLM */
  autoFillResult: AutoFillResult;
  /** Enriched opportunity with AI suggestions */
  enrichedOpportunity: EnrichedOpportunity;
  /** Callback when user accepts enrichment */
  onAccept: (acceptedOpportunity: EnrichedOpportunity) => void;
  /** Callback when user rejects enrichment */
  onReject: () => void;
  /** Callback when user modifies a field */
  onModify: (field: string, value: any) => void;
  /** Loading state */
  isLoading?: boolean;
}

interface FieldSuggestion {
  field: string;
  label: string;
  icon: React.ComponentType<any>;
  value: any;
  confidence: number;
  reasoning: string;
  accepted: boolean;
  modified: boolean;
  originalValue?: any;
}

const OpportunityEnrichmentPreview: React.FC<OpportunityEnrichmentPreviewProps> = ({
  originalOpportunity,
  autoFillResult,
  enrichedOpportunity,
  onAccept,
  onReject,
  onModify,
  isLoading = false
}) => {
  const t = useTranslations('modules.opportunities.enrichment');

  // State for field modifications
  const [fieldModifications, setFieldModifications] = useState<Record<string, any>>({});
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get original value for a field
  const getOriginalValue = useCallback((field: string): any => {
    switch (field) {
      case 'suggestedTags':
        return originalOpportunity.tags || [];
      case 'estimatedBudget':
        return originalOpportunity.budget;
      case 'requiredSkills':
        return originalOpportunity.requiredSkills || [];
      case 'industryCategory':
        return originalOpportunity.category;
      case 'locationPreference':
        return undefined; // New field
      case 'experienceLevel':
        return undefined; // New field
      case 'urgency':
        return undefined; // New field
      case 'estimatedDuration':
        return undefined; // New field
      case 'companySize':
        return undefined; // New field
      case 'workType':
        return originalOpportunity.type;
      default:
        return undefined;
    }
  }, [originalOpportunity]);

  // Get human-readable field label
  const getFieldLabel = useCallback((field: string): string => {
    const labels = {
      suggestedTags: t('fields.suggestedTags'),
      estimatedBudget: t('fields.estimatedBudget'),
      requiredSkills: t('fields.requiredSkills'),
      industryCategory: t('fields.industryCategory'),
      locationPreference: t('fields.locationPreference'),
      experienceLevel: t('fields.experienceLevel'),
      urgency: t('fields.urgency'),
      estimatedDuration: t('fields.estimatedDuration'),
      companySize: t('fields.companySize'),
      workType: t('fields.workType')
    };
    return labels[field as keyof typeof labels] || field;
  }, [t]);

  // Get icon for field type
  const getFieldIcon = useCallback((field: string): React.ComponentType<any> => {
    const icons = {
      suggestedTags: Tag,
      estimatedBudget: DollarSign,
      requiredSkills: Users,
      industryCategory: Briefcase,
      locationPreference: MapPin,
      experienceLevel: TrendingUp,
      urgency: Zap,
      estimatedDuration: Clock,
      companySize: Users,
      workType: Briefcase
    };
    return icons[field as keyof typeof icons] || Tag;
  }, []);

  // Generate field suggestions from auto-fill result
  const fieldSuggestions = useMemo(() => {
    const suggestions: FieldSuggestion[] = [];

    autoFillResult.suggestions.forEach(suggestion => {
      const originalValue = getOriginalValue(suggestion.field);
      const currentValue = fieldModifications[suggestion.field] ?? enrichedOpportunity[suggestion.field as keyof EnrichedOpportunity] ?? originalValue;
      const accepted = acceptedFields.has(suggestion.field);

      suggestions.push({
        field: suggestion.field,
        label: getFieldLabel(suggestion.field),
        icon: getFieldIcon(suggestion.field),
        value: currentValue,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        accepted,
        modified: suggestion.field in fieldModifications,
        originalValue
      });
    });

    return suggestions;
  }, [autoFillResult.suggestions, enrichedOpportunity, fieldModifications, acceptedFields, getFieldIcon, getFieldLabel, getOriginalValue]);

  // Handle field acceptance
  const handleFieldAccept = useCallback((field: string, accepted: boolean) => {
    setAcceptedFields(prev => {
      const newSet = new Set(prev);
      if (accepted) {
        newSet.add(field);
      } else {
        newSet.delete(field);
      }
      return newSet;
    });
  }, []);

  // Handle field modification
  const handleFieldModify = useCallback((field: string, value: any) => {
    setFieldModifications(prev => ({
      ...prev,
      [field]: value
    }));
    onModify(field, value);
  }, [onModify]);

  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  // Get confidence icon
  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.85) return <TrendingUp className="w-4 h-4" />;
    if (confidence >= 0.7) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  // Render field value based on type
  const renderFieldValue = (suggestion: FieldSuggestion) => {
    const Icon = suggestion.icon;

    switch (suggestion.field) {
      case 'suggestedTags':
        return (
          <div className="flex flex-wrap gap-1">
            {(suggestion.value as string[])?.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        );

      case 'estimatedBudget':
        const budget = suggestion.value as any;
        if (!budget) return <span className="text-gray-500">{t('noValue')}</span>;
        return (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>{budget.currency || 'USD'} {budget.min || 0} - {budget.max || 'unlimited'}</span>
          </div>
        );

      case 'requiredSkills':
        return (
          <div className="flex flex-wrap gap-1">
            {(suggestion.value as string[])?.map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        );

      case 'locationPreference':
      case 'experienceLevel':
      case 'urgency':
      case 'companySize':
      case 'workType':
        return (
          <Select
            value={suggestion.value}
            onValueChange={(value) => handleFieldModify(suggestion.field, value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectValue')} />
            </SelectTrigger>
            <SelectContent>
              {getFieldOptions(suggestion.field).map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return (
          <Input
            value={suggestion.value || ''}
            onChange={(e) => handleFieldModify(suggestion.field, e.target.value)}
            placeholder={t('enterValue')}
          />
        );
    }
  };

  // Get options for select fields
  const getFieldOptions = (field: string) => {
    const options = {
      locationPreference: [
        { value: 'remote', label: t('options.remote') },
        { value: 'hybrid', label: t('options.hybrid') },
        { value: 'onsite', label: t('options.onsite') }
      ],
      experienceLevel: [
        { value: 'junior', label: t('options.junior') },
        { value: 'mid', label: t('options.mid') },
        { value: 'senior', label: t('options.senior') },
        { value: 'lead', label: t('options.lead') }
      ],
      urgency: [
        { value: 'low', label: t('options.low') },
        { value: 'medium', label: t('options.medium') },
        { value: 'high', label: t('options.high') }
      ],
      companySize: [
        { value: 'startup', label: t('options.startup') },
        { value: 'scaleup', label: t('options.scaleup') },
        { value: 'enterprise', label: t('options.enterprise') }
      ],
      workType: [
        { value: 'full-time', label: t('options.fullTime') },
        { value: 'part-time', label: t('options.partTime') },
        { value: 'contract', label: t('options.contract') },
        { value: 'freelance', label: t('options.freelance') }
      ]
    };
    return options[field as keyof typeof options] || [];
  };

  // Handle accept all fields
  const handleAcceptAll = () => {
    const acceptedOpportunity = { ...enrichedOpportunity } as any;
    fieldSuggestions.forEach(suggestion => {
      if (suggestion.field in fieldModifications) {
        acceptedOpportunity[suggestion.field] = fieldModifications[suggestion.field];
      }
    });
    onAccept(acceptedOpportunity);
  };

  // Calculate acceptance stats
  const acceptanceStats = {
    total: fieldSuggestions.length,
    accepted: acceptedFields.size,
    modified: Object.keys(fieldModifications).length,
    pending: fieldSuggestions.length - acceptedFields.size
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            {t('title')}
          </CardTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-green-600" />
                {t('stats.accepted')}: {acceptanceStats.accepted}
              </span>
              <span className="flex items-center gap-1">
                <Edit className="w-4 h-4 text-blue-600" />
                {t('stats.modified')}: {acceptanceStats.modified}
              </span>
              <span className="flex items-center gap-1">
                <Minus className="w-4 h-4 text-gray-600" />
                {t('stats.pending')}: {acceptanceStats.pending}
              </span>
            </div>
            <Badge variant="outline" className="flex items-center gap-1">
              {getConfidenceIcon(autoFillResult.confidence)}
              {Math.round(autoFillResult.confidence * 100)}% {t('confidence')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Overall confidence alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('description')}
            </AlertDescription>
          </Alert>

          {/* Field suggestions */}
          <div className="space-y-4">
            <AnimatePresence>
              {fieldSuggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.field}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <suggestion.icon className="w-5 h-5 text-gray-600" />
                      <div>
                        <h4 className="font-medium">{suggestion.label}</h4>
                        <p className="text-sm text-gray-600">{suggestion.reasoning}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`flex items-center gap-1 ${getConfidenceColor(suggestion.confidence)}`}
                      >
                        {getConfidenceIcon(suggestion.confidence)}
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                      <Checkbox
                        checked={suggestion.accepted}
                        onCheckedChange={(checked) => handleFieldAccept(suggestion.field, checked as boolean)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {renderFieldValue(suggestion)}
                    {suggestion.modified && (
                      <div className="text-xs text-blue-600 flex items-center gap-1">
                        <Edit className="w-3 h-3" />
                        {t('modified')}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAdvanced(!showAdvanced)}
                size="sm"
              >
                {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onReject}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-2" />
                {t('reject')}
              </Button>
              <Button
                onClick={handleAcceptAll}
                disabled={isLoading || acceptanceStats.accepted === 0}
              >
                <Check className="w-4 h-4 mr-2" />
                {t('acceptSelected')}
              </Button>
            </div>
          </div>

          {/* Advanced information */}
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t pt-4 space-y-3"
            >
              <h4 className="font-medium">{t('advancedInfo')}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">{t('processingTime')}:</span>
                  <br />
                  <span className="font-medium">{autoFillResult.processingTime}ms</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('suggestionsCount')}:</span>
                  <br />
                  <span className="font-medium">{autoFillResult.suggestions.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('confidence')}:</span>
                  <br />
                  <span className="font-medium">{Math.round(autoFillResult.confidence * 100)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('aiModel')}:</span>
                  <br />
                  <span className="font-medium">GPT-4o</span>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default OpportunityEnrichmentPreview;
