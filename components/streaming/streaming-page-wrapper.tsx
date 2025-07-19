import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EnhancedSuspenseBoundary } from '@/components/suspense/enhanced-suspense-boundary'

interface StreamingPageWrapperProps {
  children: React.ReactNode
  header?: React.ReactNode
  sidebar?: React.ReactNode
  footer?: React.ReactNode
  staticContent?: React.ReactNode
  priority?: 'high' | 'medium' | 'low'
}

interface StreamingSectionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  priority?: 'high' | 'medium' | 'low'
  name?: string
  description?: string
}

/**
 * Streaming SSR Page Wrapper
 * 
 * This component implements streaming SSR to improve initial page load performance
 * by sending different parts of the page as they become available.
 * 
 * Benefits:
 * - Immediate static content display
 * - Progressive enhancement with dynamic content
 * - Better perceived performance
 * - SEO optimization with static content first
 * 
 * Streaming Strategy:
 * 1. Static content (header, navigation) - Immediate
 * 2. High priority content (main content) - Stream first
 * 3. Medium priority content (sidebar) - Stream second
 * 4. Low priority content (footer, widgets) - Stream last
 */
export default function StreamingPageWrapper({
  children,
  header,
  sidebar,
  footer,
  staticContent,
  priority = 'high'
}: StreamingPageWrapperProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Static Header - Renders immediately */}
      {header && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {header}
        </div>
      )}

      {/* Static Content - Renders immediately with no JavaScript */}
      {staticContent && (
        <div className="border-b bg-muted/20">
          {staticContent}
        </div>
      )}

      {/* Main Content Area with Streaming */}
      <div className="flex-1 flex">
        {/* Sidebar - Medium Priority Streaming */}
        {sidebar && (
          <aside className="w-64 shrink-0 border-r bg-muted/20 p-4">
            <StreamingSection
              priority="medium"
              name="sidebar"
              description="Loading navigation and filters"
              fallback={<SidebarSkeleton />}
            >
              {sidebar}
            </StreamingSection>
          </aside>
        )}

        {/* Main Content - High Priority Streaming */}
        <main className="flex-1 p-4">
          <StreamingSection
            priority={priority}
            name="main-content"
            description="Loading main page content"
            fallback={<MainContentSkeleton />}
          >
            {children}
          </StreamingSection>
        </main>
      </div>

      {/* Footer - Low Priority Streaming */}
      {footer && (
        <footer className="border-t bg-muted/20 p-4">
          <StreamingSection
            priority="low"
            name="footer"
            description="Loading footer content"
            fallback={<FooterSkeleton />}
          >
            {footer}
          </StreamingSection>
        </footer>
      )}
    </div>
  )
}

/**
 * Streaming Section Component
 * 
 * Wraps content in a Suspense boundary with priority-based streaming
 */
function StreamingSection({
  children,
  fallback,
  priority = 'medium',
  name,
  description
}: StreamingSectionProps) {
  const estimatedLoadTime = priority === 'high' ? 1000 : 
                           priority === 'medium' ? 2000 : 
                           3000

  return (
    <EnhancedSuspenseBoundary
      level="section"
      name={name}
      description={description}
      showProgress={false}
      estimatedLoadTime={estimatedLoadTime}
      fallback={fallback}
    >
      {children}
    </EnhancedSuspenseBoundary>
  )
}

/**
 * Skeleton Components for Streaming Fallbacks
 */
function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

function MainContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex space-x-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Additional Content */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  )
}

function FooterSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

/**
 * Specialized Streaming Wrappers for Different Page Types
 */
export function StreamingEntityPage({ children, ...props }: Omit<StreamingPageWrapperProps, 'priority'>) {
  return (
    <StreamingPageWrapper {...props} priority="high">
      {children}
    </StreamingPageWrapper>
  )
}

export function StreamingOpportunityPage({ children, ...props }: Omit<StreamingPageWrapperProps, 'priority'>) {
  return (
    <StreamingPageWrapper {...props} priority="high">
      {children}
    </StreamingPageWrapper>
  )
}

export function StreamingDashboardPage({ children, ...props }: Omit<StreamingPageWrapperProps, 'priority'>) {
  return (
    <StreamingPageWrapper {...props} priority="medium">
      {children}
    </StreamingPageWrapper>
  )
}

export function StreamingProfilePage({ children, ...props }: Omit<StreamingPageWrapperProps, 'priority'>) {
  return (
    <StreamingPageWrapper {...props} priority="medium">
      {children}
    </StreamingPageWrapper>
  )
}

/**
 * Progressive Enhancement Component
 * 
 * Renders basic content immediately and enhances with interactive features
 * as JavaScript loads and executes.
 */
export function ProgressiveEnhancement({
  children,
  fallback,
  enhance = true
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  enhance?: boolean
}) {
  if (!enhance) {
    return <>{children}</>
  }

  return (
    <Suspense fallback={fallback || <div>Loading...</div>}>
      {children}
    </Suspense>
  )
}

/**
 * Critical CSS Inlining Helper
 * 
 * This function can be used to inline critical CSS for above-the-fold content
 * improving initial page render performance.
 */
export function CriticalCSS({ css }: { css: string }) {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: css
      }}
    />
  )
}

/**
 * Resource Hints Component
 * 
 * Provides resource hints for better performance
 */
export function ResourceHints() {
  return (
    <>
      {/* DNS Prefetch */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//api.ring.ck.ua" />
      
      {/* Preconnect */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* Preload Critical Resources */}
      <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/styles/critical.css" as="style" />
      
      {/* Prefetch Next Page Resources */}
      <link rel="prefetch" href="/api/entities" />
      <link rel="prefetch" href="/api/opportunities" />
    </>
  )
} 