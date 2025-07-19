/**
 * Web Vitals Collection Service
 * Comprehensive performance monitoring with real-time metrics collection
 */

import React from 'react'
import type { Metric, ReportCallback } from 'web-vitals'

// Web Vitals types
export interface WebVitalsMetric {
  id: string
  name: string
  value: number
  delta: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url: string
  userAgent: string
  userId?: string
  sessionId?: string
  buildId?: string
  route?: string
  navigationId?: string
}

export interface PerformanceReport {
  metrics: WebVitalsMetric[]
  summary: {
    cls: WebVitalsMetric | null
    fid: WebVitalsMetric | null
    fcp: WebVitalsMetric | null
    lcp: WebVitalsMetric | null
    ttfb: WebVitalsMetric | null
    inp: WebVitalsMetric | null
  }
  timestamp: number
  sessionId: string
  userId?: string
  route?: string
  metadata: {
    userAgent: string
    url: string
    buildId?: string
    deployment?: string
    environment?: string
  }
}

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  // Core Web Vitals
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
} as const

class WebVitalsCollector {
  private metrics: Map<string, WebVitalsMetric> = new Map()
  private sessionId: string
  private userId?: string
  private isCollecting = false
  private reportEndpoint = '/api/analytics/web-vitals'
  private batchSize = 10
  private flushInterval = 30000 // 30 seconds
  private flushTimer?: NodeJS.Timeout
  private onReportCallback?: (report: PerformanceReport) => void

  constructor() {
    this.sessionId = this.generateSessionId()
    this.userId = this.getCurrentUserId()
    
    if (typeof window !== 'undefined') {
      this.setupVisibilityChangeListener()
      this.setupBeforeUnloadListener()
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getCurrentUserId(): string | undefined {
    // Get user ID from auth context, localStorage, or session
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || sessionStorage.getItem('userId') || undefined
    }
    return undefined
  }

  private getCurrentRoute(): string | undefined {
    if (typeof window !== 'undefined') {
      return window.location.pathname
    }
    return undefined
  }

  private getBuildId(): string | undefined {
    // Get build ID from environment or meta tag
    if (typeof window !== 'undefined') {
      const buildIdMeta = document.querySelector('meta[name="build-id"]')
      return buildIdMeta?.getAttribute('content') || process.env.NEXT_PUBLIC_BUILD_ID
    }
    return process.env.NEXT_PUBLIC_BUILD_ID
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS]
    if (!thresholds) return 'good'
    
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.poor) return 'needs-improvement'
    return 'poor'
  }

  private createMetric(metric: Metric): WebVitalsMetric {
    return {
      id: metric.id,
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: this.getRating(metric.name, metric.value),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      buildId: this.getBuildId(),
      route: this.getCurrentRoute(),
      navigationId: metric.navigationType || 'unknown'
    }
  }

  private handleMetric: ReportCallback = (metric: Metric) => {
    const webVitalsMetric = this.createMetric(metric)
    this.metrics.set(metric.name, webVitalsMetric)
    
    // Log metric for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Web Vitals Metric:', {
        name: metric.name,
        value: metric.value,
        rating: webVitalsMetric.rating,
        delta: metric.delta
      })
    }

    // Trigger immediate report for poor metrics
    if (webVitalsMetric.rating === 'poor') {
      this.reportMetric(webVitalsMetric)
    }

    // Schedule batch report
    this.scheduleBatchReport()
  }

  private async reportMetric(metric: WebVitalsMetric) {
    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'single-metric',
          metric,
          timestamp: Date.now()
        }),
        keepalive: true
      })
    } catch (error) {
      console.error('Failed to report Web Vitals metric:', error)
    }
  }

  private scheduleBatchReport() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }

    this.flushTimer = setTimeout(() => {
      this.sendBatchReport()
    }, this.flushInterval)
  }

  private async sendBatchReport() {
    if (this.metrics.size === 0) return

    const report = this.createPerformanceReport()
    
    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'batch-report',
          report,
          timestamp: Date.now()
        }),
        keepalive: true
      })

      // Call custom callback if provided
      this.onReportCallback?.(report)

      // Clear metrics after successful report
      this.metrics.clear()
    } catch (error) {
      console.error('Failed to send Web Vitals batch report:', error)
    }
  }

  private createPerformanceReport(): PerformanceReport {
    const metrics = Array.from(this.metrics.values())
    
    return {
      metrics,
      summary: {
        cls: this.metrics.get('CLS') || null,
        fid: this.metrics.get('FID') || null,
        fcp: this.metrics.get('FCP') || null,
        lcp: this.metrics.get('LCP') || null,
        ttfb: this.metrics.get('TTFB') || null,
        inp: this.metrics.get('INP') || null,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      route: this.getCurrentRoute(),
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        buildId: this.getBuildId(),
        deployment: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
        environment: process.env.NODE_ENV,
      }
    }
  }

  private setupVisibilityChangeListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendBatchReport()
      }
    })
  }

  private setupBeforeUnloadListener() {
    window.addEventListener('beforeunload', () => {
      this.sendBatchReport()
    })
  }

  public async startCollection() {
    if (this.isCollecting) return
    
    this.isCollecting = true
    
    try {
             // Dynamically import web-vitals to avoid SSR issues
       const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals')
       
       // Collect Core Web Vitals
       onCLS(this.handleMetric)
       onFCP(this.handleMetric)
       onLCP(this.handleMetric)
       onTTFB(this.handleMetric)
       
       // Collect INP (Interaction to Next Paint) - replaces FID
       if (onINP) {
         onINP(this.handleMetric)
       }
      
      console.log('✅ Web Vitals collection started')
    } catch (error) {
      console.error('Failed to start Web Vitals collection:', error)
      this.isCollecting = false
    }
  }

  public stopCollection() {
    this.isCollecting = false
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
    }
    
    // Send final report
    this.sendBatchReport()
    
    console.log('🛑 Web Vitals collection stopped')
  }

  public setUserId(userId: string | undefined) {
    this.userId = userId
  }

  public setReportCallback(callback: (report: PerformanceReport) => void) {
    this.onReportCallback = callback
  }

  public getMetrics(): WebVitalsMetric[] {
    return Array.from(this.metrics.values())
  }

  public getMetric(name: string): WebVitalsMetric | undefined {
    return this.metrics.get(name)
  }

  public getSessionId(): string {
    return this.sessionId
  }

  public isCollectionActive(): boolean {
    return this.isCollecting
  }

  public getPerformanceScore(): number {
    const metrics = this.getMetrics()
    if (metrics.length === 0) return 0
    
    const scores = metrics.map(metric => {
      switch (metric.rating) {
        case 'good': return 100
        case 'needs-improvement': return 75
        case 'poor': return 50
        default: return 0
      }
    })
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }
}

// Singleton instance
let webVitalsCollector: WebVitalsCollector | null = null

export function getWebVitalsCollector(): WebVitalsCollector {
  if (!webVitalsCollector) {
    webVitalsCollector = new WebVitalsCollector()
  }
  return webVitalsCollector
}

// Convenience functions
export async function startWebVitalsCollection() {
  const collector = getWebVitalsCollector()
  await collector.startCollection()
}

export function stopWebVitalsCollection() {
  const collector = getWebVitalsCollector()
  collector.stopCollection()
}

export function setWebVitalsUserId(userId: string | undefined) {
  const collector = getWebVitalsCollector()
  collector.setUserId(userId)
}

export function setWebVitalsReportCallback(callback: (report: PerformanceReport) => void) {
  const collector = getWebVitalsCollector()
  collector.setReportCallback(callback)
}

export function getWebVitalsMetrics(): WebVitalsMetric[] {
  const collector = getWebVitalsCollector()
  return collector.getMetrics()
}

export function getWebVitalsScore(): number {
  const collector = getWebVitalsCollector()
  return collector.getPerformanceScore()
}

// React hook for Web Vitals
export function useWebVitals(userId?: string) {
  const [metrics, setMetrics] = React.useState<WebVitalsMetric[]>([])
  const [score, setScore] = React.useState<number>(0)
  const [isCollecting, setIsCollecting] = React.useState(false)

  React.useEffect(() => {
    const collector = getWebVitalsCollector()
    
    if (userId) {
      collector.setUserId(userId)
    }
    
    collector.setReportCallback((report) => {
      setMetrics(report.metrics)
      setScore(collector.getPerformanceScore())
    })
    
    const startCollection = async () => {
      await collector.startCollection()
      setIsCollecting(collector.isCollectionActive())
    }
    
    startCollection()
    
    return () => {
      collector.stopCollection()
      setIsCollecting(false)
    }
  }, [userId])

  return {
    metrics,
    score,
    isCollecting,
    getMetric: (name: string) => metrics.find(m => m.name === name),
    startCollection: startWebVitalsCollection,
    stopCollection: stopWebVitalsCollection,
  }
}

// React component for Web Vitals monitoring
export function WebVitalsMonitor({ 
  userId, 
  onReport 
}: { 
  userId?: string
  onReport?: (report: PerformanceReport) => void 
}) {
  const { isCollecting, score } = useWebVitals(userId)

  React.useEffect(() => {
    if (onReport) {
      setWebVitalsReportCallback(onReport)
    }
  }, [onReport])

  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 bg-black text-white px-3 py-2 rounded-lg text-sm z-50">
        📊 Web Vitals: {isCollecting ? `Score ${score}` : 'Not collecting'}
      </div>
    )
  }

  return null
}

export default WebVitalsCollector