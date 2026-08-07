/**
 * Entity Interactions Script for Ring Platform
 * Tracks entity-specific interactions, views, and engagement metrics
 */

(function() {
  'use strict';

  // Entity interactions configuration
  const ENTITY_CONFIG = {
    STORAGE_KEY: 'ring-entity-interactions',
    BATCH_SIZE: 12,
    FLUSH_INTERVAL: 45000, // 45 seconds
    ANALYTICS_ENDPOINT: '/api/analytics/entities',
    VIEW_THRESHOLD: 1000, // 1 second to count as a view
    ENGAGEMENT_THRESHOLD: 5000 // 5 seconds to count as engagement
  };

  // Entity interactions utilities
  const EntityInteractions = {
    session: {
      id: null,
      userId: null,
      startTime: null,
      interactions: []
    },

    queue: [],
    viewTimers: new Map(),
    engagementTimers: new Map(),
    currentEntity: null,

    /**
     * Initialize entity interactions tracking
     */
    initialize() {
      this.initializeSession();
      this.attachEventListeners();
      this.startPeriodicFlush();
      console.log('🏢 Entity interactions tracking initialized');
    },

    /**
     * Initialize session
     */
    initializeSession() {
      this.session = {
        id: this.generateSessionId(),
        userId: null,
        startTime: Date.now(),
        interactions: []
      };
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Set user information
     */
    setUser(userId) {
      this.session.userId = userId;
    },

    /**
     * Track entity view
     */
    trackEntityView(entityId, entityName, entityType, metadata = {}) {
      const interaction = {
        timestamp: Date.now(),
        type: 'entity_view',
        entityId: entityId,
        entityName: entityName,
        entityType: entityType,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.session.interactions.push(interaction);
      this.queueInteraction(interaction);
      
      // Start view timer
      this.startViewTimer(entityId);
      
      // Track current entity
      this.currentEntity = {
        id: entityId,
        name: entityName,
        type: entityType,
        viewStartTime: Date.now()
      };
    },

    /**
     * Track entity card interaction
     */
    trackEntityCard(entityId, entityName, action, metadata = {}) {
      const interaction = {
        timestamp: Date.now(),
        type: 'entity_card_interaction',
        entityId: entityId,
        entityName: entityName,
        action: action,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(interaction);
    },

    /**
     * Start view timer for entity
     */
    startViewTimer(entityId) {
      // Clear existing timer
      if (this.viewTimers.has(entityId)) {
        clearTimeout(this.viewTimers.get(entityId));
      }

      // Start view timer
      const viewTimer = setTimeout(() => {
        this.trackEntityEngagement(entityId, 'view_duration_reached');
        this.viewTimers.delete(entityId);
      }, ENTITY_CONFIG.VIEW_THRESHOLD);

      this.viewTimers.set(entityId, viewTimer);
    },

    /**
     * Track entity engagement
     */
    trackEntityEngagement(entityId, engagementType, metadata = {}) {
      const interaction = {
        timestamp: Date.now(),
        type: 'entity_engagement',
        entityId: entityId,
        engagementType: engagementType,
        metadata: metadata,
        sessionId: this.session.id,
        userId: this.session.userId,
        url: window.location.href
      };

      this.queueInteraction(interaction);
    },

    /**
     * Queue interaction for batch sending
     */
    queueInteraction(interaction) {
      this.queue.push(interaction);
      
      // Auto-flush if queue is full
      if (this.queue.length >= ENTITY_CONFIG.BATCH_SIZE) {
        this.flushQueue();
      }
    },

    /**
     * Flush interactions queue
     */
    async flushQueue() {
      if (this.queue.length === 0) return;

      const batch = this.queue.splice(0, ENTITY_CONFIG.BATCH_SIZE);
      
      try {
        await fetch(ENTITY_CONFIG.ANALYTICS_ENDPOINT, {
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
        console.warn('Failed to send entity interactions:', error);
        // Re-queue failed interactions
        this.queue.unshift(...batch);
      }
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Track entity card clicks
      document.addEventListener('click', (event) => {
        const entityCard = event.target.closest('[data-entity-card]');
        if (entityCard) {
          const entityId = entityCard.dataset.entityId;
          const entityName = entityCard.dataset.entityName;
          const action = event.target.dataset.action || 'click';
          if (entityId && entityName) {
            this.trackEntityCard(entityId, entityName, action);
          }
        }
      });

      // Track page unload
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
      }, ENTITY_CONFIG.FLUSH_INTERVAL);
    }
  };

  // Initialize entity interactions tracking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      EntityInteractions.initialize();
    });
  } else {
    EntityInteractions.initialize();
  }

  // Make EntityInteractions available globally
  window.EntityInteractions = EntityInteractions;

  // Expose convenient tracking functions
  window.trackEntityView = (entityId, entityName, entityType, metadata) => 
    EntityInteractions.trackEntityView(entityId, entityName, entityType, metadata);

})(); 