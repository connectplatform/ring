/**
 * Navigation Analytics Script for Ring Platform
 * Tracks navigation events, page views, and user interactions
 */

(function() {
  'use strict';

  // Navigation analytics configuration
  const NAVIGATION_CONFIG = {
    STORAGE_KEY: 'ring-navigation-session',
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    DEBOUNCE_TIME: 300, // 300ms debounce for rapid clicks
    BATCH_SIZE: 10, // Send analytics in batches
    ANALYTICS_ENDPOINT: '/api/analytics/navigation'
  };

  // Navigation analytics utilities
  const NavigationAnalytics = {
    session: {
      id: null,
      startTime: null,
      lastActivity: null,
      pageViews: [],
      interactions: []
    },

    queue: [],
    debounceTimer: null,

    /**
     * Initialize navigation analytics
     */
    initialize() {
      this.initializeSession();
      this.trackPageLoad();
      this.attachEventListeners();
      this.startPeriodicFlush();
      console.log('🧭 Navigation analytics initialized');
    },

    /**
     * Initialize or restore session
     */
    initializeSession() {
      try {
        const stored = localStorage.getItem(NAVIGATION_CONFIG.STORAGE_KEY);
        const now = Date.now();
        
        if (stored) {
          const session = JSON.parse(stored);
          // Check if session is still valid
          if (now - session.lastActivity < NAVIGATION_CONFIG.SESSION_TIMEOUT) {
            this.session = session;
            this.session.lastActivity = now;
            return;
          }
        }
        
        // Create new session
        this.session = {
          id: this.generateSessionId(),
          startTime: now,
          lastActivity: now,
          pageViews: [],
          interactions: []
        };
        
        this.saveSession();
      } catch (error) {
        console.warn('Failed to initialize navigation session:', error);
      }
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Save session to localStorage
     */
    saveSession() {
      try {
        localStorage.setItem(NAVIGATION_CONFIG.STORAGE_KEY, JSON.stringify(this.session));
      } catch (error) {
        console.warn('Failed to save navigation session:', error);
      }
    },

    /**
     * Track page load event
     */
    trackPageLoad() {
      const pageView = {
        timestamp: Date.now(),
        url: window.location.href,
        pathname: window.location.pathname,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        language: navigator.language,
        platform: navigator.platform
      };

      this.session.pageViews.push(pageView);
      this.session.lastActivity = Date.now();
      this.saveSession();
      
      this.queueEvent('page_view', pageView);
    },

    /**
     * Track navigation interaction
     */
    trackNavigation(element, action, destination) {
      const interaction = {
        timestamp: Date.now(),
        type: 'navigation',
        action: action,
        element: element.tagName,
        elementId: element.id,
        elementClass: element.className,
        text: element.textContent?.trim()?.substring(0, 100),
        destination: destination,
        currentUrl: window.location.href,
        sessionId: this.session.id
      };

      this.session.interactions.push(interaction);
      this.session.lastActivity = Date.now();
      this.saveSession();
      
      this.queueEvent('navigation_click', interaction);
    },

    /**
     * Track menu interactions
     */
    trackMenuInteraction(menuType, action, item) {
      const interaction = {
        timestamp: Date.now(),
        type: 'menu_interaction',
        menuType: menuType,
        action: action,
        item: item,
        currentUrl: window.location.href,
        sessionId: this.session.id
      };

      this.queueEvent('menu_interaction', interaction);
    },

    /**
     * Track theme toggle
     */
    trackThemeToggle(oldTheme, newTheme) {
      const interaction = {
        timestamp: Date.now(),
        type: 'theme_toggle',
        oldTheme: oldTheme,
        newTheme: newTheme,
        currentUrl: window.location.href,
        sessionId: this.session.id
      };

      this.queueEvent('theme_toggle', interaction);
    },

    /**
     * Track language change
     */
    trackLanguageChange(oldLang, newLang) {
      const interaction = {
        timestamp: Date.now(),
        type: 'language_change',
        oldLanguage: oldLang,
        newLanguage: newLang,
        currentUrl: window.location.href,
        sessionId: this.session.id
      };

      this.queueEvent('language_change', interaction);
    },

    /**
     * Track search interactions
     */
    trackSearch(query, results) {
      const interaction = {
        timestamp: Date.now(),
        type: 'search',
        query: query,
        resultsCount: results,
        currentUrl: window.location.href,
        sessionId: this.session.id
      };

      this.queueEvent('search', interaction);
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

      // Debounce batch sending
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      this.debounceTimer = setTimeout(() => {
        this.flushQueue();
      }, NAVIGATION_CONFIG.DEBOUNCE_TIME);
    },

    /**
     * Flush analytics queue
     */
    async flushQueue() {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, NAVIGATION_CONFIG.BATCH_SIZE);
      
      try {
        await fetch(NAVIGATION_CONFIG.ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.session.id,
            events: batch
          })
        });
      } catch (error) {
        console.warn('Failed to send navigation analytics:', error);
        // Re-queue failed events
        this.queue.unshift(...batch);
      }
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Track navigation clicks
      document.addEventListener('click', (event) => {
        const element = event.target.closest('a, button[data-nav]');
        if (element) {
          const href = element.href || element.dataset.href;
          const action = element.dataset.action || 'click';
          this.trackNavigation(element, action, href);
        }
      });

      // Track menu interactions
      document.addEventListener('click', (event) => {
        const menuItem = event.target.closest('[data-menu-item]');
        if (menuItem) {
          const menuType = menuItem.dataset.menuType || 'unknown';
          const action = menuItem.dataset.action || 'click';
          const item = menuItem.dataset.menuItem;
          this.trackMenuInteraction(menuType, action, item);
        }
      });

      // Track theme changes
      window.addEventListener('themeChange', (event) => {
        const oldTheme = localStorage.getItem('ring-theme') || 'system';
        this.trackThemeToggle(oldTheme, event.detail.theme);
      });

      // Track page unload
      window.addEventListener('beforeunload', () => {
        this.flushQueue();
      });

      // Track page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.flushQueue();
        }
      });
    },

    /**
     * Start periodic queue flushing
     */
    startPeriodicFlush() {
      setInterval(() => {
        this.flushQueue();
      }, 30000); // Flush every 30 seconds
    },

    /**
     * Get current session data
     */
    getSessionData() {
      return {
        ...this.session,
        queueSize: this.queue.length
      };
    },

    /**
     * Reset session (useful for testing)
     */
    resetSession() {
      this.session = {
        id: this.generateSessionId(),
        startTime: Date.now(),
        lastActivity: Date.now(),
        pageViews: [],
        interactions: []
      };
      this.queue = [];
      this.saveSession();
    }
  };

  // Initialize navigation analytics when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      NavigationAnalytics.initialize();
    });
  } else {
    NavigationAnalytics.initialize();
  }

  // Make NavigationAnalytics available globally for React components
  window.NavigationAnalytics = NavigationAnalytics;

  // Expose convenient tracking functions
  window.trackNavigation = (element, action, destination) => 
    NavigationAnalytics.trackNavigation(element, action, destination);
  window.trackSearch = (query, results) => 
    NavigationAnalytics.trackSearch(query, results);
  window.trackMenuInteraction = (menuType, action, item) => 
    NavigationAnalytics.trackMenuInteraction(menuType, action, item);

})(); 