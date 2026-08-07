/**
 * Notification Error Boundary - React 19 Enhanced
 * Advanced error handling for notification components
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class NotificationErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Log to monitoring service
    console.error('Notification Error:', error, errorInfo);
    
    // Report to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: `Notification Error: ${error.message}`,
        fatal: false
      });
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount < 3) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      });
    }
  };

  handleAutoRetry = () => {
    // Auto-retry after 5 seconds for network errors
    if (this.state.error?.message.includes('fetch') || 
        this.state.error?.message.includes('network')) {
      this.retryTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, 5000);
    }
  };

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) {
      this.handleAutoRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="p-6 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Notification System Error
              </h3>
              
              <p className="text-red-700 dark:text-red-300 mb-4">
                {this.state.error?.message || 'An unexpected error occurred in the notification system.'}
              </p>

              <div className="flex items-center space-x-3">
                <Button
                  onClick={this.handleRetry}
                  disabled={this.state.retryCount >= 3}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Retry'}
                </Button>

                <Button
                  onClick={() => window.location.href = '/settings/notifications'}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>

              {this.state.retryCount > 0 && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Retry attempt: {this.state.retryCount}/3
                </p>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-sm font-medium cursor-pointer">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900 p-2 rounded overflow-auto">
                    {this.state.error?.stack}
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping notification components with error boundary
 */
export function withNotificationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <NotificationErrorBoundary fallback={fallback}>
        <Component {...props} />
      </NotificationErrorBoundary>
    );
  };
} 