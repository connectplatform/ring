'use client'
import React from 'react'
import type { ExtendedVendorProfile } from '@/features/store/types/vendor'
import { useTranslations } from 'next-intl'

interface VendorAnalyticsDashboardProps {
  vendorProfile: ExtendedVendorProfile
  className?: string
}

export function VendorAnalyticsDashboard({
  vendorProfile,
  className = ''
}: VendorAnalyticsDashboardProps) {
  const t = useTranslations('modules.store.vendor')

  const { analytics, qualityProfile, compliance, aiInsights, sustainability } = vendorProfile

  // ERP Extension: Performance metrics cards
  const performanceCards = [
    {
      title: 'Sales Velocity',
      value: `${analytics.salesVelocity.toFixed(1)}/day`,
      icon: '📈',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Customer Retention',
      value: `${analytics.customerRetention.toFixed(1)}%`,
      icon: '🔄',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Quality Score',
      value: `${qualityProfile.qualityScore}/100`,
      icon: '⭐',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Trust Score',
      value: `${vendorProfile.trustScore}/100`,
      icon: '🛡️',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  // ERP Extension: Compliance status indicators
  const complianceIndicators = [
    {
      label: 'FSMA Compliant',
      status: compliance.fsmaCompliant,
      icon: compliance.fsmaCompliant ? '✅' : '❌'
    },
    {
      label: 'EU GDPR Compliant',
      status: compliance.euGdprCompliant,
      icon: compliance.euGdprCompliant ? '✅' : '❌'
    },
    {
      label: 'Organic Certified',
      status: compliance.organicCertified,
      icon: compliance.organicCertified ? '✅' : '❌'
    },
    {
      label: 'Fair Trade Certified',
      status: compliance.fairTradeCertified,
      icon: compliance.fairTradeCertified ? '✅' : '❌'
    }
  ]

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span>📊</span>
        Vendor Analytics Dashboard
      </h2>

      {/* ERP Extension: Performance Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {performanceCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-lg p-4 border`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{card.icon}</span>
              <span className={`text-sm font-medium ${card.color}`}>
                {card.value}
              </span>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
          </div>
        ))}
      </div>

      {/* ERP Extension: Compliance Status */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Compliance Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {complianceIndicators.map((indicator, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-lg">{indicator.icon}</span>
              <span className={`text-sm ${indicator.status ? 'text-green-700' : 'text-red-700'}`}>
                {indicator.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ERP Extension: AI Insights */}
      {aiInsights && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <span>🤖</span>
            AI Insights
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h4 className="font-medium text-purple-800 mb-2">Growth Forecast</h4>
              <p className="text-purple-700">
                {aiInsights.growthForecast > 0 ? '+' : ''}{aiInsights.growthForecast.toFixed(1)}% expected growth
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <h4 className="font-medium text-orange-800 mb-2">Churn Risk</h4>
              <p className={`text-orange-700 ${aiInsights.churnProbability > 50 ? 'font-bold' : ''}`}>
                {aiInsights.churnProbability.toFixed(1)}% probability
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERP Extension: Sustainability Metrics */}
      {sustainability && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <span>🌍</span>
            Sustainability Metrics
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h4 className="font-medium text-green-800 mb-1">Carbon Footprint</h4>
              <p className="text-green-700 text-lg font-bold">
                {sustainability.carbonFootprint.toFixed(1)} kg CO2
              </p>
              <p className="text-xs text-green-600">per product</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-1">Renewable Energy</h4>
              <p className="text-blue-700 text-lg font-bold">
                {sustainability.renewableEnergyUsage}%
              </p>
              <p className="text-xs text-blue-600">of total energy</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <h4 className="font-medium text-teal-800 mb-1">Social Impact</h4>
              <p className="text-teal-700 text-lg font-bold">
                {sustainability.socialImpactScore}/100
              </p>
              <p className="text-xs text-teal-600">impact score</p>
            </div>
          </div>
        </div>
      )}

      {/* ERP Extension: Operational Excellence */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
          <span>⚡</span>
          Operational Excellence
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Order Fulfillment Time</span>
              <span className="font-medium">{analytics.orderFulfillmentTime.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Return Rate</span>
              <span className="font-medium">{analytics.returnRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Market Share</span>
              <span className="font-medium">{analytics.marketShare.toFixed(1)}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Inventory Turnover</span>
              <span className="font-medium">{vendorProfile.operationalMetrics.inventoryTurnover.toFixed(1)}x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quality Pass Rate</span>
              <span className="font-medium">{vendorProfile.operationalMetrics.qualityControlPassRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Supplier Reliability</span>
              <span className="font-medium">{vendorProfile.operationalMetrics.supplierReliability.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ERP Extension: AI Recommendations */}
      {aiInsights?.recommendedActions && aiInsights.recommendedActions.length > 0 && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <span>💡</span>
            AI Recommendations
          </h3>
          <div className="space-y-2">
            {aiInsights.recommendedActions.slice(0, 5).map((action, index) => (
              <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-600 mt-0.5">•</span>
                <span className="text-blue-800 text-sm">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
