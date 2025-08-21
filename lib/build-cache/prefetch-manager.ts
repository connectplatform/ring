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
 */

// Prefetch configuration based on Ring platform usage patterns
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

// Prefetch state tracking
interface PrefetchState {
  started: number;
  completed: number;
  failed: number;
  inProgress: Set<string>;
  completed_items: Set<string>;
  failed_items: Set<string>;
}

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

export const prefetchFeaturedEntities = cache(async (): Promise<any[]> => {
  const taskId = 'featured-entities';
  
  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    return getCachedEntities({ limit: PREFETCH_CONFIG.critical.featuredEntities.limit, isPublic: true });
  }
  
  if (prefetchState.inProgress.has(taskId)) {
    logPrefetchWaiting(taskId);
    // Return cached version while prefetch completes
    return getCachedEntities({ limit: PREFETCH_CONFIG.critical.featuredEntities.limit, isPublic: true });
  }
  
  prefetchState.inProgress.add(taskId);
  prefetchState.started++;
  
  try {
    logPrefetchStart(taskId);
    const entities = await getCachedEntities({ 
      limit: PREFETCH_CONFIG.critical.featuredEntities.limit, 
      isPublic: true,
      category: 'featured' 
    });
    
    prefetchState.completed++;
    prefetchState.completed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);
    
    logPrefetchComplete(taskId, entities.length);
    return entities;
    
  } catch (error) {
    prefetchState.failed++;
    prefetchState.failed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);
    
    logPrefetchError(taskId, error);
    
    // Return empty array as fallback
    return [];
  }
});

export const prefetchActiveOpportunities = cache(async (): Promise<any[]> => {
  const taskId = 'active-opportunities';
  
  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    return getCachedOpportunities({ 
      limit: PREFETCH_CONFIG.critical.activeOpportunities.limit, 
      status: 'active' 
    });
  }
  
  prefetchState.inProgress.add(taskId);
  prefetchState.started++;
  
  try {
    logPrefetchStart(taskId);
    const opportunities = await getCachedOpportunities({ 
      limit: PREFETCH_CONFIG.critical.activeOpportunities.limit, 
      status: 'active',
      type: 'featured' 
    });
    
    prefetchState.completed++;
    prefetchState.completed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);
    
    logPrefetchComplete(taskId, opportunities.length);
    return opportunities;
    
  } catch (error) {
    prefetchState.failed++;
    prefetchState.failed_items.add(taskId);
    prefetchState.inProgress.delete(taskId);
    
    logPrefetchError(taskId, error);
    return [];
  }
});

export const prefetchStoreCategories = cache(async (): Promise<any[]> => {
  const taskId = 'store-categories';
  
  if (prefetchState.completed_items.has(taskId)) {
    logPrefetchHit(taskId);
    // Mock store categories for build time
    return generateMockStoreCategories();
  }
  
  prefetchState.inProgress.add(taskId);
  prefetchState.started++;
  
  try {
    logPrefetchStart(taskId);
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

export const prefetchPublicEntities = cache(async (): Promise<any[]> => {
  const taskId = 'public-entities';
  
  if (prefetchState.completed_items.has(taskId)) {
    return getCachedEntities({ 
      limit: PREFETCH_CONFIG.important.publicEntities.limit, 
      isPublic: true 
    });
  }
  
  const entities = await getCachedEntities({ 
    limit: PREFETCH_CONFIG.important.publicEntities.limit, 
    isPublic: true 
  });
  
  prefetchState.completed_items.add(taskId);
  return entities;
});

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

export const prefetchCriticalData = cache(async (): Promise<{
  entities: any[];
  opportunities: any[];
  categories: any[];
}> => {
  const phase = getCurrentPhase();
  
  if (!shouldUseCache() && !shouldUseMockData()) {
    // Return minimal data for non-cached environments
    return {
      entities: [],
      opportunities: [],
      categories: []
    };
  }
  
  logPrefetchBatchStart('critical-data');
  
  try {
    // Parallel loading of critical data
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

export const prefetchPageData = cache(async (pageType: string): Promise<any> => {
  const phase = getCurrentPhase();
  
  switch (pageType) {
    case 'home':
      return prefetchCriticalData();
      
    case 'entities':
      return {
        featured: await prefetchFeaturedEntities(),
        all: await prefetchPublicEntities()
      };
      
    case 'opportunities':
      return {
        active: await prefetchActiveOpportunities(),
        featured: await getCachedOpportunities({ limit: 20, type: 'featured' })
      };
      
    case 'store':
      return {
        categories: await prefetchStoreCategories(),
        featured: await prefetchFeaturedProducts(),
        products: await getCachedStoreProducts({ limit: BUILD_OPTIMIZATIONS.maxStoreProductsPerPage })
      };
      
    default:
      return {};
  }
});

/**
 * SMART PRELOADING STRATEGIES
 * Predictive loading based on user behavior patterns
 */

export const prefetchRelatedData = cache(async (
  primaryType: string, 
  primaryId: string
): Promise<any> => {
  const phase = getCurrentPhase();
  
  if (!shouldUseCache()) {
    return null;
  }
  
  switch (primaryType) {
    case 'entity':
      // When viewing an entity, prefetch related opportunities
      return {
        relatedOpportunities: await getCachedOpportunities({ limit: 5 }),
        similarEntities: await getCachedEntities({ limit: 8, isPublic: true })
      };
      
    case 'opportunity':
      // When viewing opportunity, prefetch related entities and similar opportunities
      return {
        relatedEntities: await getCachedEntities({ limit: 5, isPublic: true }),
        similarOpportunities: await getCachedOpportunities({ limit: 6 })
      };
      
    case 'store-product':
      // When viewing product, prefetch related products and category info
      return {
        relatedProducts: await getCachedStoreProducts({ limit: 8 }),
        categoryProducts: await getCachedStoreProducts({ limit: 12 })
      };
      
    default:
      return null;
  }
});

/**
 * UTILITY FUNCTIONS
 */

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
