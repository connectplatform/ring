/**
 * Entity List Analytics Script for Ring Platform
 * Tracks entity list interactions, pagination, filtering, and performance metrics
 */

(function() {
  'use strict';

  // Entity list analytics configuration
  const LIST_CONFIG = {
    STORAGE_KEY: 'ring-entity-list-analytics',
    BATCH_SIZE: 8,
    FLUSH_INTERVAL: 30000, // 30 seconds
    ANALYTICS_ENDPOINT: '/api/analytics/entity-lists',
    SCROLL_THRESHOLD: 100, // pixels
    INTERACTION_DEBOUNCE: 250 // milliseconds
  };

  // Entity list analytics utilities
  const EntityListAnalytics = {
    session: {
      id: null,
      userId: null,
      startTime: null,
      listViews: [],
      interactions: []
    },

    queue: [],
    scrollPositions: new Map(),
    interactionTimers: new Map(),
    currentListState: null,

    /**
     * Initialize entity list analytics
     */
    initialize() {
      this.initializeSession();
      this.attachEventListeners();
      this.startPeriodicFlush();
      console.log('📋 Entity list analytics initialized');
    },

    /**
     * Initialize session
     */
    initializeSession() {
      this.session = {
        id: this.generateSessionId(),
        userId: null,
        startTime: Date.now(),
        listViews: [],
        interactions: []
      };
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `list_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Set user information
     */
    setUser(userId) {
      this.session.userId = userId;
    },

    /**
     * Track entity list view
     */
    trackListView(listType, totalItems, displayedItems, filters = {}, sortBy = null) {
      const listView = {
        timestamp: Date.now(),
        type: 'list_view',
        listType: listType,
        totalItems: totalItems,
        displayedItems: displayedItems,
        filters: filters,
        sortBy: sortBy,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };

      this.session.listViews.push(listView);
      this.queueInteraction(listView);
      
      // Update current list state
      this.currentListState = {
        type: listType,
        totalItems: totalItems,
        displayedItems: displayedItems,
        filters: filters,
        sortBy: sortBy,
        viewStartTime: Date.now()
      };
    },

    /**
     * Track entity list scroll
     */
    trackListScroll(listType, scrollPosition, scrollPercentage, visibleItems = []) {
      const scrollInteraction = {
        timestamp: Date.now(),
        type: 'list_scroll',
        listType: listType,
        scrollPosition: scrollPosition,
        scrollPercentage: scrollPercentage,
        visibleItems: visibleItems,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(scrollInteraction);
    },

    /**
     * Track entity list filter change
     */
    trackFilterChange(filterType, filterValue, previousValue, resultsCount) {
      const filterInteraction = {
        timestamp: Date.now(),
        type: 'filter_change',
        filterType: filterType,
        filterValue: filterValue,
        previousValue: previousValue,
        resultsCount: resultsCount,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(filterInteraction);
    },

    /**
     * Track entity list sort change
     */
    trackSortChange(sortBy, sortDirection, previousSort, resultsCount) {
      const sortInteraction = {
        timestamp: Date.now(),
        type: 'sort_change',
        sortBy: sortBy,
        sortDirection: sortDirection,
        previousSort: previousSort,
        resultsCount: resultsCount,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(sortInteraction);
    },

    /**
     * Track entity list pagination
     */
    trackPagination(page, totalPages, itemsPerPage, totalItems) {
      const paginationInteraction = {
        timestamp: Date.now(),
        type: 'pagination',
        page: page,
        totalPages: totalPages,
        itemsPerPage: itemsPerPage,
        totalItems: totalItems,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(paginationInteraction);
    },

    /**
     * Track entity list item interaction
     */
    trackItemInteraction(itemId, itemType, action, position, metadata = {}) {
      const itemInteraction = {
        timestamp: Date.now(),
        type: 'item_interaction',
        itemId: itemId,
        itemType: itemType,
        action: action, // 'click', 'hover', 'view', 'bookmark'
        position: position,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(itemInteraction);
    },

    /**
     * Track entity list search
     */
    trackListSearch(query, resultsCount, searchDuration, metadata = {}) {
      const searchInteraction = {
        timestamp: Date.now(),
        type: 'list_search',
        query: query,
        resultsCount: resultsCount,
        searchDuration: searchDuration,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(searchInteraction);
    },

    /**
     * Track entity list performance
     */
    trackListPerformance(listType, loadTime, renderTime, itemCount, metadata = {}) {
      const performanceMetrics = {
        timestamp: Date.now(),
        type: 'list_performance',
        listType: listType,
        loadTime: loadTime,
        renderTime: renderTime,
        itemCount: itemCount,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(performanceMetrics);
    },

    /**
     * Track entity list empty state
     */
    trackEmptyState(listType, reason, filters = {}, metadata = {}) {
      const emptyStateInteraction = {
        timestamp: Date.now(),
        type: 'empty_state',
        listType: listType,
        reason: reason, // 'no_results', 'no_data', 'filter_results', 'search_results'
        filters: filters,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(emptyStateInteraction);
    },

    /**
     * Track entity list loading state
     */
    trackLoadingState(listType, loadingDuration, success, error = null) {
      const loadingInteraction = {
        timestamp: Date.now(),
        type: 'loading_state',
        listType: listType,
        loadingDuration: loadingDuration,
        success: success,
        error: error,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(loadingInteraction);
    },

    /**
     * Debounced scroll tracking
     */
    trackScrollDebounced(listType, scrollElement) {
      const scrollKey = `${listType}_scroll`;
      
      if (this.interactionTimers.has(scrollKey)) {
        clearTimeout(this.interactionTimers.get(scrollKey));
      }

      const timer = setTimeout(() => {
        const scrollTop = scrollElement.scrollTop;
        const scrollHeight = scrollElement.scrollHeight;
        const clientHeight = scrollElement.clientHeight;
        const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
        
        this.trackListScroll(listType, scrollTop, scrollPercentage);
        this.interactionTimers.delete(scrollKey);
      }, LIST_CONFIG.INTERACTION_DEBOUNCE);

      this.interactionTimers.set(scrollKey, timer);
    },

    /**
     * Queue interaction for batch sending
     */
    queueInteraction(interaction) {
      this.queue.push(interaction);
      
      // Auto-flush if queue is full
      if (this.queue.length >= LIST_CONFIG.BATCH_SIZE) {
        this.flushQueue();
      }
    },

    /**
     * Flush interactions queue
     */
    async flushQueue() {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, LIST_CONFIG.BATCH_SIZE);
      
      try {
        await fetch(LIST_CONFIG.ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: this.session.id,
            userId: this.session.userId,
            interactions: batch
          })
        });
      } catch (error) {
        console.warn('Failed to send entity list analytics:', error);
        // Re-queue failed interactions
        this.queue.unshift(...batch);
      }
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Track list item clicks
      document.addEventListener('click', (event) => {
        const listItem = event.target.closest('[data-list-item]');
        if (listItem) {
          const itemId = listItem.dataset.itemId;
          const itemType = listItem.dataset.itemType;
          const position = listItem.dataset.position;
          const action = event.target.dataset.action || 'click';
          
          if (itemId && itemType) {
            this.trackItemInteraction(itemId, itemType, action, position);
          }
        }
      });

      // Track list scrolling
      document.addEventListener('scroll', (event) => {
        const listContainer = event.target.closest('[data-list-container]');
        if (listContainer) {
          const listType = listContainer.dataset.listType;
          if (listType) {
            this.trackScrollDebounced(listType, listContainer);
          }
        }
      }, true);

      // Track filter changes
      document.addEventListener('change', (event) => {
        const filterElement = event.target.closest('[data-filter]');
        if (filterElement) {
          const filterType = filterElement.dataset.filter;
          const filterValue = filterElement.value;
          const previousValue = filterElement.dataset.previousValue;
          
          if (filterType) {
            // Get results count from associated list
            const listContainer = document.querySelector(`[data-list-container][data-filter-target="${filterType}"]`);
            const resultsCount = listContainer ? listContainer.dataset.itemCount : 0;
            
            this.trackFilterChange(filterType, filterValue, previousValue, resultsCount);
            
            // Update previous value
            filterElement.dataset.previousValue = filterValue;
          }
        }
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
      }, LIST_CONFIG.FLUSH_INTERVAL);
    },

    /**
     * Get analytics summary
     */
    getAnalyticsSummary() {
      return {
        sessionId: this.session.id,
        userId: this.session.userId,
        listViews: this.session.listViews.length,
        totalInteractions: this.session.interactions.length,
        queueSize: this.queue.length,
        currentListState: this.currentListState
      };
    }
  };

  // Initialize entity list analytics when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      EntityListAnalytics.initialize();
    });
  } else {
    EntityListAnalytics.initialize();
  }

  // Make EntityListAnalytics available globally
  window.EntityListAnalytics = EntityListAnalytics;

  // Expose convenient tracking functions
  window.trackListView = (listType, totalItems, displayedItems, filters, sortBy) => 
    EntityListAnalytics.trackListView(listType, totalItems, displayedItems, filters, sortBy);
  window.trackListSearch = (query, resultsCount, searchDuration, metadata) => 
    EntityListAnalytics.trackListSearch(query, resultsCount, searchDuration, metadata);
  window.trackListPerformance = (listType, loadTime, renderTime, itemCount, metadata) => 
    EntityListAnalytics.trackListPerformance(listType, loadTime, renderTime, itemCount, metadata);
  window.setListAnalyticsUser = (userId) => 
    EntityListAnalytics.setUser(userId);

})(); 