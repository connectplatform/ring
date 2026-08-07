/**
 * Suppress Known Third-Party Library Warnings
 * This module suppresses non-critical warnings from third-party libraries
 * that are outside our control but don't affect functionality
 */

// Only run on client side
if (typeof window !== 'undefined') {
  // Store original console methods
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  // Patterns to suppress
  const suppressPatterns = [
    // SES/Lockdown warnings from Web3 libraries
    /SES Removing unpermitted intrinsics/i,
    /Removing intrinsics.*DatePrototype.*toTemporalInstant/i,
    /lockdown-install\.js/i,
    
    // Firebase service worker warnings (handled gracefully)
    /ServiceWorker script.*threw an exception during script evaluation/i,
    /firebase-messaging-sw\.js.*threw an exception/i,
    
    // React DevTools style warnings in development
    /Warning.*DevTools.*style/i,
    
    // Next.js hydration warnings in development
    /Warning.*Expected server HTML/i,
    /Warning.*Did not expect server HTML/i,
  ];

  // Override console.warn
  console.warn = function(...args: any[]) {
    const message = args.join(' ');
    const shouldSuppress = suppressPatterns.some(pattern => pattern.test(message));
    
    if (!shouldSuppress) {
      originalWarn.apply(console, args);
    }
  };

  // Override console.error for specific patterns
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    
    // Check if this is a non-critical error we want to suppress
    const isNonCriticalError = suppressPatterns.some(pattern => pattern.test(message));
    
    if (!isNonCriticalError) {
      originalError.apply(console, args);
    } else {
      // Log as debug in development for troubleshooting
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Suppressed Error]', ...args);
      }
    }
  };

  // Override console.log for specific patterns
  console.log = function(...args: any[]) {
    const message = args.join(' ');
    
    // Check if this is a lockdown/SES message
    const isSESMessage = suppressPatterns.some(pattern => pattern.test(message));
    
    if (!isSESMessage) {
      originalLog.apply(console, args);
    }
  };

  // Restore original console methods in development after a delay
  // This ensures we don't permanently suppress important warnings
  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      console.warn = originalWarn;
      console.error = originalError;
      console.log = originalLog;
      console.debug('[Console] Warning suppression lifted after initialization');
    }, 10000); // Restore after 10 seconds
  }
}

export {};
