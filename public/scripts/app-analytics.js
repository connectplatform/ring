/**
 * App Analytics Script for Ring Platform
 * Tracks app-level events, user interactions, and performance metrics
 */

(function() {
  'use strict';

  // App analytics configuration
  const APP_CONFIG = {
    STORAGE_KEY: 'ring-app-analytics',
    SESSION_KEY: 'ring-app-session',
    BATCH_SIZE: 15,
    FLUSH_INTERVAL: 30000, // 30 seconds
    ANALYTICS_ENDPOINT: '/api/analytics/app',
    PERFORMANCE_ENDPOINT: '/api/analytics/performance'
  };

  // App analytics utilities
  const AppAnalytics = {
    session: {
      id: null,
      startTime: null,
      userId: null,
      userRole: null,
      events: []
    },

    queue: [],
    performanceMetrics: [],

    /**
     * Initialize app analytics
     */
    initialize() {
      this.initializeSession();
      this.trackAppLoad();
      this.attachEventListeners();
      this.startPeriodicFlush();
      this.trackPerformanceMetrics();
      console.log('📊 App analytics initialized');
    },

    /**
     * Initialize analytics session
     */
    initializeSession() {
      try {
        const stored = localStorage.getItem(APP_CONFIG.SESSION_KEY);
        const now = Date.now();
        
        if (stored) {
          this.session = JSON.parse(stored);
          this.session.lastActivity = now;
        } else {
          this.session = {
            id: this.generateSessionId(),
            startTime: now,
            lastActivity: now,
            userId: null,
            userRole: null,
            events: []
          };
        }
        
        this.saveSession();
      } catch (error) {
        console.warn('Failed to initialize app analytics session:', error);
      }
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Save session to localStorage
     */
    saveSession() {
      try {
        localStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(this.session));
      } catch (error) {
        console.warn('Failed to save app analytics session:', error);
      }
    },

    /**
     * Set user information
     */
    setUser(userId, userRole = null) {
      this.session.userId = userId;
      this.session.userRole = userRole;
      this.saveSession();
      
      this.trackEvent('user_identified', {
        userId: userId,
        userRole: userRole,
        timestamp: Date.now()
      });
    },

    /**
     * Track app load event
     */
    trackAppLoad() {
      const loadEvent = {
        timestamp: Date.now(),
        type: 'app_load',
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        connectionType: navigator.connection?.effectiveType || 'unknown',
        onlineStatus: navigator.onLine
      };

      this.session.events.push(loadEvent);
      this.saveSession();
      this.queueEvent('app_load', loadEvent);
    },

    /**
     * Track feature usage
     */
    trackFeatureUsage(featureName, action, metadata = {}) {
      const event = {
        timestamp: Date.now(),
        type: 'feature_usage',
        feature: featureName,
        action: action,
        metadata: metadata,
        userId: this.session.userId,
        userRole: this.session.userRole,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('feature_usage', event);
    },

    /**
     * Track authentication events
     */
    trackAuth(action, method = null, success = true) {
      const event = {
        timestamp: Date.now(),
        type: 'auth_event',
        action: action, // 'login', 'logout', 'signup', 'password_reset'
        method: method, // 'google', 'email', 'github', etc.
        success: success,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('auth_event', event);
    },

    /**
     * Track API calls
     */
    trackApiCall(endpoint, method, statusCode, duration, error = null) {
      const event = {
        timestamp: Date.now(),
        type: 'api_call',
        endpoint: endpoint,
        method: method,
        statusCode: statusCode,
        duration: duration,
        error: error,
        userId: this.session.userId,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('api_call', event);
    },

    /**
     * Track user interactions
     */
    trackInteraction(elementType, action, elementId = null, metadata = {}) {
      const event = {
        timestamp: Date.now(),
        type: 'user_interaction',
        elementType: elementType,
        action: action,
        elementId: elementId,
        metadata: metadata,
        userId: this.session.userId,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('user_interaction', event);
    },

    /**
     * Track form interactions
     */
    trackForm(formName, action, fieldName = null, value = null) {
      const event = {
        timestamp: Date.now(),
        type: 'form_interaction',
        formName: formName,
        action: action, // 'start', 'field_change', 'submit', 'abandon'
        fieldName: fieldName,
        value: value ? String(value).substring(0, 100) : null, // Truncate for privacy
        userId: this.session.userId,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('form_interaction', event);
    },

    /**
     * Track business events
     */
    trackBusinessEvent(eventType, entityType, entityId, metadata = {}) {
      const event = {
        timestamp: Date.now(),
        type: 'business_event',
        eventType: eventType, // 'entity_created', 'opportunity_viewed', etc.
        entityType: entityType, // 'entity', 'opportunity', 'user', etc.
        entityId: entityId,
        metadata: metadata,
        userId: this.session.userId,
        sessionId: this.session.id,
        url: window.location.href
      };

      this.trackEvent('business_event', event);
    },

    /**
     * Track performance metrics
     */
    trackPerformanceMetrics() {
      // Wait for page to load
      if (document.readyState === 'complete') {
        this.collectPerformanceMetrics();
      } else {
        window.addEventListener('load', () => {
          setTimeout(() => this.collectPerformanceMetrics(), 1000);
        });
      }
    },

    /**
     * Collect performance metrics
     */
    collectPerformanceMetrics() {
      try {
        if (typeof performance !== 'undefined' && performance.timing) {
          const timing = performance.timing;
          const navigation = performance.navigation;
          
          const metrics = {
            timestamp: Date.now(),
            type: 'performance_metrics',
            sessionId: this.session.id,
            url: window.location.href,
            
            // Navigation timing
            dns: timing.domainLookupEnd - timing.domainLookupStart,
            connect: timing.connectEnd - timing.connectStart,
            request: timing.responseEnd - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            dom: timing.domComplete - timing.domLoading,
            load: timing.loadEventEnd - timing.loadEventStart,
            total: timing.loadEventEnd - timing.navigationStart,
            
            // Navigation type
            navigationType: navigation.type,
            redirectCount: navigation.redirectCount,
            
            // Connection info
            connectionType: navigator.connection?.effectiveType || 'unknown',
            connectionSpeed: navigator.connection?.downlink || 0,
            
            // Memory info (Chrome only)
            memoryUsed: performance.memory?.usedJSHeapSize || 0,
            memoryTotal: performance.memory?.totalJSHeapSize || 0,
            memoryLimit: performance.memory?.jsHeapSizeLimit || 0
          };

          this.performanceMetrics.push(metrics);
          this.queueEvent('performance_metrics', metrics);
        }
      } catch (error) {
        console.warn('Failed to collect performance metrics:', error);
      }
    },

    /**
     * Track generic event
     */
    trackEvent(type, data) {
      const event = {
        type: type,
        data: data,
        timestamp: Date.now(),
        sessionId: this.session.id
      };

      this.queueEvent(type, event);
    },

    /**
     * Queue event for batch sending
     */
    queueEvent(type, data) {
      this.queue.push({
        type: type,
        data: data,
        timestamp: Date.now()
      });

      // Auto-flush if queue is full
      if (this.queue.length >= APP_CONFIG.BATCH_SIZE) {
        this.flushQueue();
      }
    },

    /**
     * Flush analytics queue
     */
    async flushQueue() {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, APP_CONFIG.BATCH_SIZE);
      
      try {
        await fetch(APP_CONFIG.ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.session.id,
            userId: this.session.userId,
            events: batch
          })
        });
      } catch (error) {
        console.warn('Failed to send app analytics:', error);
        // Re-queue failed events
        this.queue.unshift(...batch);
      }
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Track page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.trackEvent('page_hidden', { timestamp: Date.now() });
          this.flushQueue();
        } else {
          this.trackEvent('page_visible', { timestamp: Date.now() });
        }
      });

      // Track page unload
      window.addEventListener('beforeunload', () => {
        this.trackEvent('page_unload', { timestamp: Date.now() });
        this.flushQueue();
      });

      // Track online/offline status
      window.addEventListener('online', () => {
        this.trackEvent('connection_online', { timestamp: Date.now() });
      });

      window.addEventListener('offline', () => {
        this.trackEvent('connection_offline', { timestamp: Date.now() });
      });

      // Track resize events
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.trackEvent('viewport_resize', {
            timestamp: Date.now(),
            width: window.innerWidth,
            height: window.innerHeight
          });
        }, 250);
      });
    },

    /**
     * Start periodic queue flushing
     */
    startPeriodicFlush() {
      setInterval(() => {
        this.flushQueue();
      }, APP_CONFIG.FLUSH_INTERVAL);
    },

    /**
     * Get analytics summary
     */
    getAnalyticsSummary() {
      return {
        session: this.session,
        queueSize: this.queue.length,
        performanceMetrics: this.performanceMetrics.length
      };
    }
  };

  // Initialize app analytics when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AppAnalytics.initialize();
    });
  } else {
    AppAnalytics.initialize();
  }

  // Make AppAnalytics available globally
  window.AppAnalytics = AppAnalytics;

  // Expose convenient tracking functions
  window.trackFeature = (feature, action, metadata) => 
    AppAnalytics.trackFeatureUsage(feature, action, metadata);
  window.trackAuth = (action, method, success) => 
    AppAnalytics.trackAuth(action, method, success);
  window.trackBusinessEvent = (eventType, entityType, entityId, metadata) => 
    AppAnalytics.trackBusinessEvent(eventType, entityType, entityId, metadata);
  window.trackForm = (formName, action, fieldName, value) => 
    AppAnalytics.trackForm(formName, action, fieldName, value);
  window.setAnalyticsUser = (userId, userRole) => 
    AppAnalytics.setUser(userId, userRole);

})(); 