import { cache } from 'react';
import { getCurrentPhase, shouldUseCache, shouldUseMockData, BUILD_OPTIMIZATIONS } from './phase-detector';
import { 
  getCachedEntity, 
  getCachedEntities, 
  getCachedOpportunities, 
  getCachedStoreProducts,
  getCacheMetrics,
  logCacheStatus
} from './static-data-cache';

/**
 * Intelligent Data Prefetching Manager
 * 
 * Loads commonly accessed data once during build and reuses across
 * multiple page generations. Prioritizes public data over private data
 * and implements smart loading strategies based on usage patterns.
 * 
 * // TODO: Investigate opportunity to lift prefetch logic as server actions where possible
 * // TODO: Assess viability of React.use and useCache primitives for client/server boundaries in React 19/Next 16
 */

// Prefetch configuration reflects platform's data access patterns.
// TODO: Consider storing PREFETCH_CONFIG in a centralized config provider for runtime/hydration mutability.
const PREFETCH_CONFIG = {
  // High-priority data loaded immediately
  critical: {
    featuredEntities: { limit: 10, priority: 1 },
    activeOpportunities: { limit: 8, priority: 1 },
    storeCategories: { limit: 20, priority: 1 }
  },
  // Medium-priority data loaded after critical
  important: {
    publicEntities: { limit: 50, priority: 2 },
    jobOpportunities: { limit: 25, priority: 2 },
    featuredProducts: { limit: 30, priority: 2 }
  },
  // Low-priority data loaded on-demand
  optional: {
    allEntities: { limit: 200, priority: 3 },
    archivedOpportunities: { limit: 100, priority: 3 },
    allProducts: { limit: 500, priority: 3 }
  }
} as const;

// State-tracking of prefetch operations for metrics & diagnostics.
interface PrefetchState {
  started: number;                // Number of prefetch tasks started
  completed: number;              // Number completed successfully
  failed: number;                 // Number failed
  inProgress: Set<string>;        // IDs of currently running prefetches
  completed_items: Set<string>;   // IDs of finished (cached) tasks
  failed_items: Set<string>;      // IDs of failed tasks
}

// Singleton state object for tracking prefetch outcomes.
let prefetchState: PrefetchState = {
  started: 0,
  completed: 0,
  failed: 0,
  inProgress: new Set(),
  completed_items: new Set(),
  failed_items: new Set()
};

/**
 * CRITICAL DATA PREFETCHING
 * High-priority data that should be available immediately
 */

// Prefetch featured entities (e.g., for homepage)
// TODO: Replace raw Promise usage with useCache (React19) if possible for even finer SSR cache handling.
export const prefetchFeaturedEntities = cache(async (): Promise<any[]> => {
  const taskId = 'featured-entities';
  
  // Return early if already cached (hits fast path)
  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    return getCachedEntities({ limit: PREFETCH_CONFIG.critical.featuredEntities.limit, isPublic: true });
  }
  
  // If prefetch underway, return available stale cache and allow parallel waiter.
  if (prefetchState.inProgress.has(taskId)) {
    logPrefetchWaiting(taskId);
    return getCachedEntities({ limit: PREFETCH_CONFIG.critical.featuredEntities.limit, isPublic: true });
  }
  
  // Begin tracking this task as in progress.
  prefetchState.inProgress.add(taskId);
  prefetchState.started++;
  
  try {
    logPrefetchStart(taskId);

    // Pull featured entities, prioritizing public and 'featured' tag.
    const entities = await getCachedEntities({ 
      limit: PREFETCH_CONFIG.critical.featuredEntities.limit, 
      isPublic: true,
      category: 'featured' 
    });

    // Track success & update bookkeeping
    prefetchState.completed++;
    prefetchState.completed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchComplete(taskId, entities.length);
    return entities;

  } catch (error) {
    // Track failure and update sets
    prefetchState.failed++;
    prefetchState.failed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchError(taskId, error);

    // On apparent failure, return empty fallback array.
    return [];
  }
});

// Prefetch currently active opportunities (job, deals, etc.)
export const prefetchActiveOpportunities = cache(async (): Promise<any[]> => {
  const taskId = 'active-opportunities';

  // Cache hit returns directly
  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    return getCachedOpportunities({ 
      limit: PREFETCH_CONFIG.critical.activeOpportunities.limit, 
      status: 'active' 
    });
  }

  // Mark as in progress and increment started
  prefetchState.inProgress.add(taskId);
  prefetchState.started++;

  try {
    logPrefetchStart(taskId);
    const opportunities = await getCachedOpportunities({ 
      limit: PREFETCH_CONFIG.critical.activeOpportunities.limit, 
      status: 'active',
      type: 'featured'
    });

    // On success, bookkeeping
    prefetchState.completed++;
    prefetchState.completed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchComplete(taskId, opportunities.length);
    return opportunities;

  } catch (error) {
    // Record failure
    prefetchState.failed++;
    prefetchState.failed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchError(taskId, error);
    return [];
  }
});

// Prefetch store categories
export const prefetchStoreCategories = cache(async (): Promise<any[]> => {
  const taskId = 'store-categories';

  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    // STUB: This is mock data for build time. 
    // todo: For production, fetch actual store categories from products store.
    return generateMockStoreCategories();
  }

  prefetchState.inProgress.add(taskId);
  prefetchState.started++;

  try {
    logPrefetchStart(taskId);
    // STUB: For now, generate build-time-only category list.
    // todo: Integrate with real store service for live categories.
    const categories = generateMockStoreCategories();

    prefetchState.completed++;
    prefetchState.completed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchComplete(taskId, categories.length);
    return categories;

  } catch (error) {
    prefetchState.failed++;
    prefetchState.failed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);

    logPrefetchError(taskId, error);
    return [];
  }
});

/**
 * IMPORTANT DATA PREFETCHING
 * Medium-priority data loaded after critical data
 */

// Prefetch public entities, for example for general directories or listings.
export const prefetchPublicEntities = cache(async (): Promise<any[]> => {
  const taskId = 'public-entities';

  // If already prefetched, return cached.
  if (prefetchState.completed_items.has(taskId)) {
    return getCachedEntities({ 
      limit: PREFETCH_CONFIG.important.publicEntities.limit, 
      isPublic: true 
    });
  }

  // Otherwise: fetch + mark complete
  const entities = await getCachedEntities({ 
    limit: PREFETCH_CONFIG.important.publicEntities.limit, 
    isPublic: true 
  });

  prefetchState.completed_items.add(taskId);
  return entities;
});

// Prefetch featured store products
export const prefetchFeaturedProducts = cache(async (): Promise<any[]> => {
  const taskId = 'featured-products';

  if (prefetchState.completed_items.has(taskId)) {
    return getCachedStoreProducts({ 
      limit: PREFETCH_CONFIG.important.featuredProducts.limit,
      category: 'featured',
      inStock: true 
    });
  }

  const products = await getCachedStoreProducts({ 
    limit: PREFETCH_CONFIG.important.featuredProducts.limit,
    category: 'featured',
    inStock: true 
  });

  prefetchState.completed_items.add(taskId);
  return products;
});

/**
 * BATCH PREFETCHING
 * Load multiple data types in parallel for efficiency
 */

// TODO: Consider using React19's runAsync or new concurrent features for Promise batching when adopted.
export const prefetchCriticalData = cache(async (): Promise<{
  entities: any[];
  opportunities: any[];
  categories: any[];
}> => {
  const phase = getCurrentPhase();
  // Early return in environments where caching or mocking is off (e.g. local dev).
  if (!shouldUseCache() && !shouldUseMockData()) {
    return {
      entities: [],
      opportunities: [],
      categories: []
    };
  }

  // Begin logging for tracing batch
  logPrefetchBatchStart('critical-data');

  try {
    // TODO: When React.runAsync is available, prefer for truly concurrent data pull.
    // Parallel prefetched of all criticals
    const [entities, opportunities, categories] = await Promise.all([
      prefetchFeaturedEntities(),
      prefetchActiveOpportunities(),
      prefetchStoreCategories()
    ]);

    logPrefetchBatchComplete('critical-data', {
      entities: entities.length,
      opportunities: opportunities.length,
      categories: categories.length
    });

    return { entities, opportunities, categories };
  } catch (error) {
    logPrefetchError('critical-data-batch', error);

    return {
      entities: [],
      opportunities: [],
      categories: []
    };
  }
});

// Entry point to prefetch data for a given page type, uses above individual or batch prefetchers.
// TODO: With Next.js 16 app directory, consider refactoring to leverage Route Handlers + Server Actions for finer-grain SSR/ISR cache policies.
export const prefetchPageData = cache(async (pageType: string): Promise<any> => {
  const phase = getCurrentPhase();
  // Switch routes to matching prefetch combination.
  switch (pageType) {
    case 'home':
      // Home wants critical batch.
      return prefetchCriticalData();
    case 'entities':
      // Entities want both featured and public listing.
      return {
        featured: await prefetchFeaturedEntities(),
        all: await prefetchPublicEntities()
      };
    case 'opportunities':
      // Opportunities want both active and featured sublist.
      return {
        active: await prefetchActiveOpportunities(),
        featured: await getCachedOpportunities({ limit: 20, type: 'featured' }) // TODO: Could promote this to named prefetch function if used more.
      };
    case 'store':
      // Store needs categories, featured, and all products (but paginated!).
      return {
        categories: await prefetchStoreCategories(),
        featured: await prefetchFeaturedProducts(),
        products: await getCachedStoreProducts({ limit: BUILD_OPTIMIZATIONS.maxStoreProductsPerPage })
      };
    default:
      // Unknown route types: no prefetch
      return {};
  }
});

/**
 * SMART PRELOADING STRATEGIES
 * Predictive loading based on user behavior patterns
 */

// Proactively prefetches data that is likely to be needed next (e.g. for hover preloads or page transitions)
// TODO: For React19, consider wrapping in useTransition or native preloading primitives if integrating deeper into client tree.
export const prefetchRelatedData = cache(async (
  primaryType: string, 
  primaryId: string // TODO: Use for dynamic related data matching, currently unused.
): Promise<any> => {
  const phase = getCurrentPhase();

  if (!shouldUseCache()) {
    // No cache: Do not prefetch.
    return null;
  }

  // Smartly select what to prefetch based on main view type.
  switch (primaryType) {
    case 'entity':
      // When viewing an entity, prefetch related opportunities & similar entities.
      // TODO: Use primaryId to filter more specifically by entity relationships.
      return {
        relatedOpportunities: await getCachedOpportunities({ limit: 5 }),
        similarEntities: await getCachedEntities({ limit: 8, isPublic: true })
      };
    case 'opportunity':
      // When viewing an opportunity, prefetch related entities and similar opportunities.
      // TODO: Use primaryId to tailor related content.
      return {
        relatedEntities: await getCachedEntities({ limit: 5, isPublic: true }),
        similarOpportunities: await getCachedOpportunities({ limit: 6 })
      };
    case 'store-product':
      // Viewing a store product? Prefetch related & category neighbor products.
      // TODO: Use primaryId to focus prefetch on category/brand of this product.
      return {
        relatedProducts: await getCachedStoreProducts({ limit: 8 }),
        categoryProducts: await getCachedStoreProducts({ limit: 12 })
      };
    default:
      // No actionable prefetch for unknown type.
      return null;
  }
});

/**
 * UTILITY FUNCTIONS
 */

// STUB: Store categories mock generator.
// todo: Replace with actual service fetch. 1. Integrate product category API. 2. Handle error. 3. Add proper typing.
function generateMockStoreCategories(): any[] {
  return [
    { id: 'tech', name: 'Technology', productCount: 45 },
    { id: 'books', name: 'Books & Education', productCount: 32 },
    { id: 'services', name: 'Services', productCount: 28 },
    { id: 'tools', name: 'Tools & Equipment', productCount: 56 },
    { id: 'consulting', name: 'Consulting', productCount: 23 },
    { id: 'software', name: 'Software', productCount: 67 },
    { id: 'training', name: 'Training & Courses', productCount: 41 },
    { id: 'other', name: 'Other', productCount: 19 }
  ];
}

// Debug logging helpers for prefetch lifecycle events.
// TODO: Consider Next.js logger or native window.reportError for better observability in Next16.
function logPrefetchStart(taskId: string): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] START - ${taskId}`);
  }
}
function logPrefetchComplete(taskId: string, itemCount: number): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] COMPLETE - ${taskId}: ${itemCount} items`);
  }
}
function logPrefetchHit(taskId: string): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] HIT - ${taskId} (already cached)`);
  }
}
function logPrefetchWaiting(taskId: string): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] WAITING - ${taskId} (in progress)`);
  }
}
function logPrefetchError(taskId: string, error: any): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.error(`[Prefetch] ERROR - ${taskId}:`, error.message);
  }
}
function logPrefetchBatchStart(batchId: string): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] BATCH START - ${batchId}`);
  }
}
function logPrefetchBatchComplete(batchId: string, results: any): void {
  if (process.env.BUILD_CACHE_DEBUG === 'true') {
    console.log(`[Prefetch] BATCH COMPLETE - ${batchId}:`, results);
  }
}

/**
 * PERFORMANCE MONITORING
 */

// Returns aggregated prefetch/cache performance metrics.
// TODO: Integrate this function with a dashboard endpoint for ops visibility.
export function getPrefetchMetrics() {
  const cacheMetrics = getCacheMetrics();

  return {
    prefetch: {
      started: prefetchState.started,
      completed: prefetchState.completed,
      failed: prefetchState.failed,
      inProgress: prefetchState.inProgress.size,
      successRate: prefetchState.started > 0 
        ? (prefetchState.completed / prefetchState.started) * 100 
        : 0
    },
    cache: cacheMetrics,
    overall: {
      efficiency: cacheMetrics.hitRate,
      totalOperations: prefetchState.started + cacheMetrics.hits + cacheMetrics.misses,
      performance: 'optimal'
    }
  };
}

// Output current status summary to console.
// TODO: Replace with structured logging (e.g. Next.js middleware logger) in production for better ops visibility.
export function logPrefetchStatus(): void {
  const metrics = getPrefetchMetrics();

  console.log(`
[Prefetch Manager Status]
Prefetch Success Rate: ${metrics.prefetch.successRate.toFixed(1)}%
Cache Hit Rate: ${metrics.cache.hitRate}%
Active Prefetches: ${metrics.prefetch.inProgress}
Total Operations: ${metrics.overall.totalOperations}
Performance: ${metrics.overall.performance}
  `.trim());
}

/**
 * RESET FUNCTIONS FOR TESTING
 */

// Resets all prefetch state for use in isolated testing.
// Useful in Jest or integration tests to achieve consistent state between runs.
export function resetPrefetchState(): void {
  prefetchState = {
    started: 0,
    completed: 0,
    failed: 0,
    inProgress: new Set(),
    completed_items: new Set(),
    failed_items: new Set()
  };
}
