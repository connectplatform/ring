/**
 * Ring Analytics — Real-time client telemetry.
 *
 * Batches page views and custom events, then periodically flushes them to
 * POST /api/analytics/app using sendBeacon (with fetch fallback).
 *
 * Exposes window.ringAnalytics with:
 *   - pageView(page)   — record a page view
 *   - track(event, data) — record a custom event
 *
 * @see features/analytics/lib/analytics-db.ts  (server-side ingestion)
 * @see data/migrations/017_ring_analytics_schema.sql  (DB schema)
 */
(function () {
  'use strict'

  // ---- Config ----
  var API_URL = '/api/analytics/app'
  var FLUSH_INTERVAL_MS = 5000       // flush every 5 seconds
  var MAX_BATCH_SIZE = 25            // max events per batch

  // ---- State ----
  var sessionId = generateSessionId()
  var eventBuffer = []
  var flushTimer = null
  var lastFlush = 0

  // ---- Helpers ----
  function generateSessionId() {
    var prefix = 'ring_'
    var ts = Date.now().toString(36)
    var rand = Math.random().toString(36).substring(2, 10)
    return prefix + ts + '_' + rand
  }

  /**
   * Enqueue an event into the buffer and schedule a flush if one isn't pending.
   * If the buffer exceeds MAX_BATCH_SIZE, flush immediately.
   */
  function enqueueEvent(type, data) {
    eventBuffer.push({
      type: type,
      data: data || {},
      timestamp: Date.now(),
    })

    if (eventBuffer.length >= MAX_BATCH_SIZE) {
      flushEvents()
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL_MS)
    }
  }

  /**
   * Send buffered events via navigator.sendBeacon (preferred) or fetch.
   * Resets the buffer and timer on completion.
   */
  function flushEvents() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    var batch = eventBuffer.splice(0, MAX_BATCH_SIZE)
    if (batch.length === 0) {
      lastFlush = Date.now()
      return
    }

    var payload = JSON.stringify({
      sessionId: sessionId,
      events: batch,
    })

    var flushSuccess = false

    // sendBeacon is most reliable for unload scenarios
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' })
        flushSuccess = navigator.sendBeacon(API_URL, blob)
      }
    } catch (e) {
      // fall through to fetch
    }

    if (!flushSuccess) {
      // Fallback to fetch()
      try {
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,       // hints the browser to complete the request
          priority: 'low',
        }).catch(function () {
          // Silently ignore — analytics are non-blocking
        })
      } catch (e) {
        // Silently ignore
      }
    }

    lastFlush = Date.now()
  }

  /**
   * Flush remaining events on page unload (beforeunload / pagehide).
   */
  function onUnload() {
    if (eventBuffer.length > 0) {
      flushEvents()
    }
  }

  // ---- Initialisation ----
  function init() {
    // Bind to lifecycle events for reliable flush
    if (typeof window !== 'undefined') {
      // pagehide is more reliable than beforeunload on modern browsers
      window.addEventListener('pagehide', onUnload)
      window.addEventListener('beforeunload', onUnload)
    }
  }

  // ---- Public API (window.ringAnalytics) ----
  window.ringAnalytics = {
    /**
     * Record a page view event.
     * @param {string} page - Page path or identifier
     */
    pageView: function (page) {
      enqueueEvent('page_view', {
        page: page || window.location.pathname,
        referrer: document.referrer || '',
        title: document.title || '',
      })
    },

    /**
     * Record a custom event with attached data.
     * @param {string} event - Event name (e.g. 'click', 'locale_change')
     * @param {object} data  - Arbitrary JSON-serialisable payload
     */
    track: function (event, data) {
      enqueueEvent(event, data || {})
    },

    // Expose internals for debugging / testing
    _sessionId: sessionId,
    _flush: flushEvents,
    _bufferSize: function () { return eventBuffer.length },
  }

  // Auto-track initial page view and start flush timer
  window.ringAnalytics.pageView(window.location.pathname)
  init()

  console.log('[Ring Analytics] Initialised, session:', sessionId)
})()
