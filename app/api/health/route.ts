import { NextRequest, NextResponse } from 'next/server'

/**
 * Interface describing the structure of a health check response.
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
 * Health check endpoint for Docker containers and monitoring systems.
 * Returns application status, version, and basic system information.
 */
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    
    // Determine if the backend is PostgreSQL or Firebase by checking specific environment variables.
    // If targeting React 19/Next 16 - consider using process.env from edge/runtime for better performance and compatibility
    // TODO: Investigate environment variable exposure using Next.js 16 runtime / server actions.
    const isPostgresBackend = process.env.DATABASE_BACKEND === 'postgresql' ||
      !!process.env.DB_HOST ||
      !!process.env.POSTGRES_HOST

    // Gather basic health metrics for the current process.
    // TODO: Consider caching repeated calls to process.memoryUsage() for performance.
    const health: HealthResponse = {
      status: 'healthy', // The base status, may be degraded later depending on env checks
      timestamp: new Date().toISOString(),
      // Uses package version if available, else fallback to hardcoded version string
      version: process.env.npm_package_version || '0.9.7',
      // Explicitly cast environment string to supported types
      environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
      uptime: process.uptime(),
      // All memory numbers in MB, rounded
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
        auth: 'auth.js-v5',     // TODO: Replace with actual auth service name based on env config
        realtime: 'websocket', // TODO: Replace with actual realtime service name based on env config
        storage: 'vercel-blob', // TODO: Replace with actual storage service name based on env config
      },
      // Measures time of health check execution before response - could underreport if further checks added later
      responseTime: Date.now() - startTime,
    }

    // Check if the application is running inside a Docker container.
    try {
      // fs.existsSync is synchronous. If there are perf requirements, consider reading asynchronously or using pre-flight Docker detection.
      // TODO: Investigate Next.js 16 support for detecting container features / runtime context.
      const fs = require('fs')
      if (fs.existsSync('/.dockerenv')) {
        health.container = {
          type: 'docker',
          hostname: process.env.HOSTNAME || 'unknown',
        }
      }
    } catch (error) {
      // Ignore errors - possible in environments where `fs` is not available or permission denied.
    }

    // Populate build information if environment variables are present.
    if (process.env.BUILD_DATE) {
      health.build = {
        date: process.env.BUILD_DATE,
        commit: process.env.GIT_COMMIT || 'unknown',
      }
    }

    // Determine the list of critical environment variables based on the backend
    // If backend is Postgres, only 'AUTH_SECRET' is required; otherwise, Firebase-specific environment variables are required.
    const criticalEnvVars = isPostgresBackend
      ? ['AUTH_SECRET'] // PostgreSQL backend only needs auth secret
      : ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'AUTH_SECRET', 'AUTH_FIREBASE_PROJECT_ID'] // Firebase backend

    // Find which critical env variables are missing.
    // TODO: Consider surfacing missing variables in build-time warnings via new Next.js config features.
    const missingEnvVars = criticalEnvVars.filter(envVar => !process.env[envVar])

    if (missingEnvVars.length > 0) {
      // Separate warnings into critical and optional (only AUTH_SECRET is critical)
      const warningVars = missingEnvVars.filter(v => v !== 'AUTH_SECRET')
      const criticalMissing = missingEnvVars.filter(v => v === 'AUTH_SECRET')

      // If any critical are missing, degrade health; else, add optional warnings
      if (criticalMissing.length > 0) {
        health.status = 'degraded'
        health.warnings = [`Missing critical environment variables: ${criticalMissing.join(', ')}`]
      } else if (warningVars.length > 0) {
        health.warnings = [`Optional environment variables not set: ${warningVars.join(', ')}`]
      }
    }

    // Use the status to determine HTTP code: 200 for 'healthy', 503 for other non-healthy statuses.
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
    // Log error to server console for troubleshooting
    console.error('Health check failed:', error)

    // In case of any unexpected error, reply with "unhealthy"
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

// Support HEAD requests for simple health checks (liveness probe, usually for load balancers)
export async function HEAD(request: NextRequest) {
  try {
    // Respond with 200 OK and required headers, no body.
    // TODO: Use built-in Next.js API routes routing for builtin CORS/header config (Next.js 16: middleware improvements).
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    // In rare error, mark instance as down.
    return new NextResponse(null, { status: 503 })
  }
}
