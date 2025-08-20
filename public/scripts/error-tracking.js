/**
 * Error Tracking Script for Ring Platform
 * Tracks JavaScript errors, unhandled promises, and application errors
 */

(function() {
  'use strict';

  // Error tracking configuration
  const ERROR_CONFIG = {
    STORAGE_KEY: 'ring-error-tracking',
    MAX_ERRORS: 50, // Maximum errors to store locally
    BATCH_SIZE: 10,
    FLUSH_INTERVAL: 60000, // 1 minute
    ERROR_ENDPOINT: '/api/analytics/errors',
    IGNORE_PATTERNS: [
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'Script error',
      'Network request failed',
      // React Dev + Next DevTools noisy style warnings
      'setValueForStyles',
      'react-dom-client.development.js'
    ]
  };

  // Error tracking utilities
  const ErrorTracking = {
    errors: [],
    queue: [],
    sessionId: null,
    userId: null,

    /**
     * Initialize error tracking
     */
    initialize() {
      this.sessionId = this.generateSessionId();
      this.loadStoredErrors();
      this.attachErrorHandlers();
      this.startPeriodicFlush();
      console.log('🚨 Error tracking initialized');
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Load stored errors from localStorage
     */
    loadStoredErrors() {
      try {
        const stored = localStorage.getItem(ERROR_CONFIG.STORAGE_KEY);
        if (stored) {
          this.errors = JSON.parse(stored);
          // Clean up old errors
          this.cleanupOldErrors();
        }
      } catch (error) {
        console.warn('Failed to load stored errors:', error);
      }
    },

    /**
     * Save errors to localStorage
     */
    saveErrors() {
      try {
        localStorage.setItem(ERROR_CONFIG.STORAGE_KEY, JSON.stringify(this.errors));
      } catch (error) {
        console.warn('Failed to save errors:', error);
      }
    },

    /**
     * Clean up old errors
     */
    cleanupOldErrors() {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.errors = this.errors.filter(error => error.timestamp > oneDayAgo);
      
      // Keep only the most recent errors
      if (this.errors.length > ERROR_CONFIG.MAX_ERRORS) {
        this.errors = this.errors.slice(-ERROR_CONFIG.MAX_ERRORS);
      }
    },

    /**
     * Set user information
     */
    setUser(userId) {
      this.userId = userId;
    },

    /**
     * Check if error should be ignored
     */
    shouldIgnoreError(message) {
      return ERROR_CONFIG.IGNORE_PATTERNS.some(pattern => 
        message.toLowerCase().includes(pattern.toLowerCase())
      );
    },

    /**
     * Track JavaScript error
     */
    trackError(error, context = {}) {
      try {
        const errorInfo = {
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId,
          type: 'javascript_error',
          
          // Error details
          message: error.message || 'Unknown error',
          stack: error.stack || 'No stack trace',
          name: error.name || 'Error',
          filename: error.filename || context.filename || 'unknown',
          lineno: error.lineno || context.lineno || 0,
          colno: error.colno || context.colno || 0,
          
          // Context information
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          
          // Additional context
          context: context,
          
          // Page state
          pageState: {
            visibility: document.visibilityState,
            focus: document.hasFocus(),
            online: navigator.onLine,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            }
          }
        };

        // Don't track ignored errors
        if (this.shouldIgnoreError(errorInfo.message)) {
          return;
        }

        this.errors.push(errorInfo);
        this.saveErrors();
        this.queueError(errorInfo);
        
        console.warn('Error tracked:', errorInfo);
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }
    },

    /**
     * Track unhandled promise rejection
     */
    trackPromiseRejection(event) {
      try {
        const errorInfo = {
          id: `prom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId,
          type: 'promise_rejection',
          
          // Promise rejection details
          reason: event.reason ? String(event.reason) : 'Unknown reason',
          stack: event.reason?.stack || 'No stack trace',
          
          // Context information
          url: window.location.href,
          userAgent: navigator.userAgent,
          
          // Page state
          pageState: {
            visibility: document.visibilityState,
            focus: document.hasFocus(),
            online: navigator.onLine,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            }
          }
        };

        // Don't track ignored errors
        if (this.shouldIgnoreError(errorInfo.reason)) {
          return;
        }

        this.errors.push(errorInfo);
        this.saveErrors();
        this.queueError(errorInfo);
        
        console.warn('Promise rejection tracked:', errorInfo);
      } catch (trackingError) {
        console.error('Failed to track promise rejection:', trackingError);
      }
    },

    /**
     * Track custom application error
     */
    trackCustomError(errorType, message, context = {}) {
      const errorInfo = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        type: 'custom_error',
        
        // Custom error details
        errorType: errorType,
        message: message,
        context: context,
        
        // Context information
        url: window.location.href,
        userAgent: navigator.userAgent,
        
        // Page state
        pageState: {
          visibility: document.visibilityState,
          focus: document.hasFocus(),
          online: navigator.onLine,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        }
      };

      this.errors.push(errorInfo);
      this.saveErrors();
      this.queueError(errorInfo);
    },

    /**
     * Track API error
     */
    trackApiError(endpoint, method, statusCode, responseText, context = {}) {
      const errorInfo = {
        id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        type: 'api_error',
        
        // API error details
        endpoint: endpoint,
        method: method,
        statusCode: statusCode,
        responseText: responseText ? responseText.substring(0, 1000) : null,
        context: context,
        
        // Context information
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      this.errors.push(errorInfo);
      this.saveErrors();
      this.queueError(errorInfo);
    },

    /**
     * Queue error for batch sending
     */
    queueError(errorInfo) {
      this.queue.push(errorInfo);
      
      // Auto-flush if queue is full
      if (this.queue.length >= ERROR_CONFIG.BATCH_SIZE) {
        this.flushQueue();
      }
    },

    /**
     * Flush error queue
     */
    async flushQueue() {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, ERROR_CONFIG.BATCH_SIZE);
      
      try {
        await fetch(ERROR_CONFIG.ERROR_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.sessionId,
            userId: this.userId,
            errors: batch
          })
        });
      } catch (error) {
        console.warn('Failed to send error data:', error);
        // Re-queue failed errors
        this.queue.unshift(...batch);
      }
    },

    /**
     * Attach error handlers
     */
    attachErrorHandlers() {
      // Global error handler
      window.addEventListener('error', (event) => {
        this.trackError(event.error, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          target: event.target?.tagName || 'window'
        });
      });

      // Unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        this.trackPromiseRejection(event);
      });

      // Console error override (disabled in dev to avoid noisy React/Next warnings)
      const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isDev) {
        const originalConsoleError = console.error;
        console.error = (...args) => {
          // Track console.error calls
          try {
            const msg = args.map(arg => String(arg)).join(' ');
            if (!this.shouldIgnoreError(msg)) {
              this.trackCustomError('console_error', msg, {
                arguments: args.map(arg => String(arg)).join(', ')
              });
            }
          } catch (_) {}
          // Call original console.error
          originalConsoleError.apply(console, args);
        };
      }

      // Page unload handler
      window.addEventListener('beforeunload', () => {
        this.flushQueue();
      });
    },

    /**
     * Start periodic queue flushing
     */
    startPeriodicFlush() {
      setInterval(() => {
        this.flushQueue();
        this.cleanupOldErrors();
      }, ERROR_CONFIG.FLUSH_INTERVAL);
    },

    /**
     * Get error summary
     */
    getErrorSummary() {
      const now = Date.now();
      const last24Hours = now - (24 * 60 * 60 * 1000);
      const lastHour = now - (60 * 60 * 1000);
      
      const recentErrors = this.errors.filter(error => error.timestamp > last24Hours);
      const hourlyErrors = this.errors.filter(error => error.timestamp > lastHour);
      
      return {
        total: this.errors.length,
        last24Hours: recentErrors.length,
        lastHour: hourlyErrors.length,
        queueSize: this.queue.length,
        errorTypes: this.getErrorTypeBreakdown(),
        sessionId: this.sessionId
      };
    },

    /**
     * Get error type breakdown
     */
    getErrorTypeBreakdown() {
      const breakdown = {};
      this.errors.forEach(error => {
        breakdown[error.type] = (breakdown[error.type] || 0) + 1;
      });
      return breakdown;
    },

    /**
     * Clear all errors (for testing)
     */
    clearErrors() {
      this.errors = [];
      this.queue = [];
      this.saveErrors();
    }
  };

  // Initialize error tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ErrorTracking.initialize();
    });
  } else {
    ErrorTracking.initialize();
  }

  // Make ErrorTracking available globally
  window.ErrorTracking = ErrorTracking;

  // Expose convenient tracking functions
  window.trackCustomError = (errorType, message, context) => 
    ErrorTracking.trackCustomError(errorType, message, context);
  window.trackApiError = (endpoint, method, statusCode, responseText, context) => 
    ErrorTracking.trackApiError(endpoint, method, statusCode, responseText, context);
  window.setErrorTrackingUser = (userId) => 
    ErrorTracking.setUser(userId);

})(); 