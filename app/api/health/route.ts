import { NextRequest, NextResponse } from 'next/server'

/**
 * Health check response interface
 */
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
  memory: {
    used: number
    total: number
    external: number
  }
  system: {
    platform: NodeJS.Platform
    arch: string
    nodeVersion: string
    pid: number
  }
  services: {
    database: string
    auth: string
    realtime: string
    storage: string
  }
  responseTime: number
  container?: {
    type: string
    hostname: string
  }
  build?: {
    date: string
    commit: string
  }
  warnings?: string[]
}

/**
 * Health check endpoint for Docker containers and monitoring systems
 * Returns application status, version, and basic system information
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Detect database backend early for use throughout health check
    const isPostgresBackend = process.env.DATABASE_BACKEND === 'postgresql' || 
                               !!process.env.DB_HOST || 
                               !!process.env.POSTGRES_HOST
    
    // Basic health checks
    const health: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.9.7',
      environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
      },
      services: {
        database: isPostgresBackend ? 'postgresql' : 'firebase',
        auth: 'auth.js-v5',
        realtime: 'websocket',
        storage: 'vercel-blob',
      },
      responseTime: Date.now() - startTime,
    }

    // Check if we're in a Docker container
    try {
      const fs = require('fs')
      if (fs.existsSync('/.dockerenv')) {
        health.container = {
          type: 'docker',
          hostname: process.env.HOSTNAME || 'unknown',
        }
      }
    } catch (error) {
      // Ignore filesystem errors
    }

    // Add build information if available
    if (process.env.BUILD_DATE) {
      health.build = {
        date: process.env.BUILD_DATE,
        commit: process.env.GIT_COMMIT || 'unknown',
      }
    }

    // Check critical environment variables based on database backend
    const criticalEnvVars = isPostgresBackend 
      ? ['AUTH_SECRET'] // PostgreSQL backend only needs auth secret
      : ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'AUTH_SECRET', 'AUTH_FIREBASE_PROJECT_ID'] // Firebase backend

    const missingEnvVars = criticalEnvVars.filter(envVar => !process.env[envVar])
    
    if (missingEnvVars.length > 0) {
      // Only degrade for truly critical missing vars, add warnings for others
      const warningVars = missingEnvVars.filter(v => v !== 'AUTH_SECRET')
      const criticalMissing = missingEnvVars.filter(v => v === 'AUTH_SECRET')
      
      if (criticalMissing.length > 0) {
        health.status = 'degraded'
        health.warnings = [`Missing critical environment variables: ${criticalMissing.join(', ')}`]
      } else if (warningVars.length > 0) {
        health.warnings = [`Optional environment variables not set: ${warningVars.join(', ')}`]
      }
    }

    // Return appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 503

    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  }
}

// Support HEAD requests for simple health checks
export async function HEAD(request: NextRequest) {
  try {
    // Simple check - if we can respond, we're alive
    return new NextResponse(null, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}
