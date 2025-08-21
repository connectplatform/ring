/**
 * Next.js Build Phase Detection & Data Strategy Manager
 * 
 * Intelligently detects the current execution phase and determines
 * the optimal data strategy for each phase:
 * - Build Time: Use cached/mock data for static generation
 * - Runtime: Use live data with intelligent caching
 * - Development: Balance between live data and performance
 */

// Build phase constants from Next.js
const NEXT_PHASES = {
  PRODUCTION_BUILD: 'phase-production-build',
  DEVELOPMENT_BUILD: 'phase-development-build',
  EXPORT: 'phase-export',
  PRODUCTION_SERVER: 'phase-production-server',
  DEVELOPMENT_SERVER: 'phase-development-server'
} as const;

type NextPhase = typeof NEXT_PHASES[keyof typeof NEXT_PHASES];
type DataStrategy = 'mock' | 'cached' | 'live' | 'hybrid';

interface PhaseInfo {
  phase: NextPhase | 'unknown';
  isBuildTime: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  strategy: DataStrategy;
  description: string;
}

/**
 * Detects the current Next.js execution phase
 */
export function detectBuildPhase(): PhaseInfo {
  const nextPhase = process.env.NEXT_PHASE as NextPhase;
  const nodeEnv = process.env.NODE_ENV;
  const isVercel = process.env.VERCEL === '1';
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // Build time detection
  const isBuildTime = !!(
    nextPhase === NEXT_PHASES.PRODUCTION_BUILD ||
    nextPhase === NEXT_PHASES.DEVELOPMENT_BUILD ||
    nextPhase === NEXT_PHASES.EXPORT ||
    // Additional build detection methods
    process.argv.includes('build') ||
    process.argv.includes('export')
  );
  
  // Environment detection
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  
  // Determine data strategy based on phase
  let strategy: DataStrategy;
  let description: string;
  
  switch (nextPhase) {
    case NEXT_PHASES.PRODUCTION_BUILD:
      strategy = 'mock';
      description = 'Production build - using mock data for static generation';
      break;
      
    case NEXT_PHASES.DEVELOPMENT_BUILD:
      strategy = 'cached';
      description = 'Development build - using cached data for faster builds';
      break;
      
    case NEXT_PHASES.EXPORT:
      strategy = 'cached';
      description = 'Static export - using cached data for pages';
      break;
      
    case NEXT_PHASES.PRODUCTION_SERVER:
      strategy = 'hybrid';
      description = 'Production runtime - intelligent caching with live data';
      break;
      
    case NEXT_PHASES.DEVELOPMENT_SERVER:
      strategy = 'live';
      description = 'Development runtime - live data with minimal caching';
      break;
      
    default:
      if (isBuildTime) {
        strategy = 'mock';
        description = 'Build detected - using mock data';
      } else if (isProduction) {
        strategy = 'hybrid';
        description = 'Production runtime - hybrid caching strategy';
      } else {
        strategy = 'live';
        description = 'Development/unknown - using live data';
      }
  }
  
  return {
    phase: nextPhase || 'unknown',
    isBuildTime,
    isProduction,
    isDevelopment,
    strategy,
    description
  };
}

/**
 * Cached phase detection for performance
 */
let cachedPhaseInfo: PhaseInfo | null = null;

export function getCurrentPhase(): PhaseInfo {
  if (!cachedPhaseInfo) {
    cachedPhaseInfo = detectBuildPhase();
    
    if (process.env.BUILD_CACHE_DEBUG === 'true') {
      console.log(`[Phase Detector] ${cachedPhaseInfo.description}`);
    }
  }
  
  return cachedPhaseInfo;
}

/**
 * Phase-specific data strategies
 */
export const DATA_STRATEGIES = {
  mock: {
    useFirebase: false,
    useCache: false,
    generateMockData: true,
    description: 'Mock data only - no external connections'
  },
  
  cached: {
    useFirebase: false,
    useCache: true,
    generateMockData: false,
    description: 'Cached data with fallback to mocks'
  },
  
  live: {
    useFirebase: true,
    useCache: false,
    generateMockData: false,
    description: 'Live Firebase data - minimal caching'
  },
  
  hybrid: {
    useFirebase: true,
    useCache: true,
    generateMockData: false,
    description: 'Smart caching with live data fallback'
  }
} as const;

/**
 * Get data strategy configuration for current phase
 */
export function getDataStrategy() {
  const phase = getCurrentPhase();
  return DATA_STRATEGIES[phase.strategy];
}

/**
 * Conditional execution based on build phase
 */
export function isBuildTime(): boolean {
  return getCurrentPhase().isBuildTime;
}

export function isProductionRuntime(): boolean {
  const phase = getCurrentPhase();
  return phase.isProduction && !phase.isBuildTime;
}

export function isDevelopmentRuntime(): boolean {
  const phase = getCurrentPhase();
  return phase.isDevelopment && !phase.isBuildTime;
}

export function shouldUseMockData(): boolean {
  return getDataStrategy().generateMockData;
}

export function shouldUseCache(): boolean {
  return getDataStrategy().useCache;
}

export function shouldUseFirebase(): boolean {
  return getDataStrategy().useFirebase;
}

/**
 * Performance optimization helpers
 */
export function optimizeForBuild<T>(buildValue: T, runtimeValue: T): T {
  return isBuildTime() ? buildValue : runtimeValue;
}

export function skipDuringBuild<T>(fn: () => T, fallback?: T): T | undefined {
  if (isBuildTime()) {
    return fallback;
  }
  return fn();
}

// Removed conditionalImport function to fix webpack critical dependency warning
// The dynamic import with variable path was causing: "Critical dependency: the request of a dependency is an expression"
// This function was not used anywhere in the codebase

/**
 * Build-specific logging
 */
export function logPhaseInfo(): void {
  const phase = getCurrentPhase();
  const strategy = getDataStrategy();
  
  console.log(`
[Build Phase Detection]
Phase: ${phase.phase}
Environment: ${phase.isProduction ? 'production' : 'development'}
Build Time: ${phase.isBuildTime ? 'yes' : 'no'}
Strategy: ${phase.strategy} - ${strategy.description}
Firebase: ${strategy.useFirebase ? 'enabled' : 'disabled'}
Cache: ${strategy.useCache ? 'enabled' : 'disabled'}
Mocks: ${strategy.generateMockData ? 'enabled' : 'disabled'}
  `.trim());
}

/**
 * Environment-specific configurations
 */
export const BUILD_OPTIMIZATIONS = {
  // Skip expensive operations during build
  skipAnalytics: isBuildTime(),
  skipNotifications: isBuildTime(),
  skipRealTimeUpdates: isBuildTime(),
  
  // Use minimal data during build
  maxEntitiesPerPage: optimizeForBuild(10, 50),
  maxOpportunitiesPerPage: optimizeForBuild(8, 30),
  maxStoreProductsPerPage: optimizeForBuild(12, 60),
  
  // Cache TTL adjustments
  buildCacheTTL: 24 * 60 * 60 * 1000, // 24 hours during build
  runtimeCacheTTL: 15 * 60 * 1000, // 15 minutes during runtime
  
  // Feature flags based on build phase
  enableAdvancedSearch: !isBuildTime(),
  enableRealTimeChat: isProductionRuntime(),
  enablePushNotifications: !isBuildTime()
};

/**
 * Reset phase detection (useful for testing)
 */
export function resetPhaseDetection(): void {
  cachedPhaseInfo = null;
}

// Log phase info on module load for debugging
if (process.env.BUILD_CACHE_DEBUG === 'true') {
  logPhaseInfo();
}

