/**
 * Rate Limiting for API Routes and WebSocket Connections
 * Prevents brute force attacks and DoS attempts
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Check if request should be rate limited
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return false
    }

    // Increment counter
    entry.count++

    // Check if limit exceeded
    if (entry.count > this.maxRequests) {
      console.warn(`⚠️ Rate limit exceeded for ${identifier}: ${entry.count} requests`)
      return true
    }

    return false
  }

  /**
   * Get remaining requests for identifier
   */
  getRemainingRequests(identifier: string): number {
    const entry = this.limits.get(identifier)
    if (!entry || entry.resetTime < Date.now()) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - entry.count)
  }

  /**
   * Get reset time for identifier
   */
  getResetTime(identifier: string): number {
    const entry = this.limits.get(identifier)
    return entry?.resetTime || Date.now()
  }

  /**
   * Clean up expired entries
   */
  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime < now) {
        this.limits.delete(key)
      }
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.limits.clear()
  }
}

// Create rate limiters for different endpoints
export const authRateLimiter = new RateLimiter(60000, 5) // 5 auth attempts per minute
export const apiRateLimiter = new RateLimiter(60000, 100) // 100 API calls per minute
export const wsRateLimiter = new RateLimiter(60000, 10) // 10 WebSocket connections per minute

/**
 * Express/Next.js middleware for rate limiting
 */
export function rateLimitMiddleware(limiter: RateLimiter = apiRateLimiter) {
  return (req: any, res: any, next?: any) => {
    // Use IP address as identifier (consider using user ID for authenticated requests)
    const identifier = req.headers['x-forwarded-for'] || 
                      req.connection?.remoteAddress || 
                      req.ip || 
                      'unknown'

    if (limiter.isRateLimited(identifier)) {
      const resetTime = limiter.getResetTime(identifier)
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter['maxRequests'])
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())
      res.setHeader('Retry-After', retryAfter)
      
      // Return 429 Too Many Requests
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter
      })
    }

    // Set rate limit headers for successful requests
    res.setHeader('X-RateLimit-Limit', limiter['maxRequests'])
    res.setHeader('X-RateLimit-Remaining', limiter.getRemainingRequests(identifier))
    res.setHeader('X-RateLimit-Reset', new Date(limiter.getResetTime(identifier)).toISOString())

    if (next) {
      next()
    }
  }
}

/**
 * Socket.IO middleware for rate limiting
 */
export function socketRateLimitMiddleware(limiter: RateLimiter = wsRateLimiter) {
  return (socket: any, next: any) => {
    const identifier = socket.handshake.address || 
                      socket.request.connection.remoteAddress || 
                      'unknown'

    if (limiter.isRateLimited(identifier)) {
      const error = new Error('Rate limit exceeded')
      ;(error as any).data = {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((limiter.getResetTime(identifier) - Date.now()) / 1000)
      }
      return next(error)
    }

    next()
  }
}

export default RateLimiter
