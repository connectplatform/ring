type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'warn')
const LOG_SILENT = process.env.LOG_SILENT === 'true'

const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(level: LogLevel): boolean {
  if (LOG_SILENT) return false
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL as LogLevel]
}

function format(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  // In development, skip verbose messages
  if (process.env.NODE_ENV === 'development') {
    // Skip JWT verification failures (expected in dev)
    if (message.includes('JWT verification failed') ||
        message.includes('Auth.js encrypted session token detected')) {
      return null
    }
    // Skip SSE anonymous connections (normal dev behavior)
    if (message.includes('[SSE] Anonymous connection')) {
      return null
    }
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta || {}),
  }
  return JSON.stringify(payload)
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) =>
    shouldLog('debug') && console.debug(format('debug', message, meta)),

  info: (message: string, meta?: Record<string, unknown>) =>
    shouldLog('info') && console.info(format('info', message, meta)),

  warn: (message: string, meta?: Record<string, unknown>) =>
    shouldLog('warn') && console.warn(format('warn', message, meta)),

  error: (message: string, meta?: Record<string, unknown>) =>
    shouldLog('error') && console.error(format('error', message, meta)),
}


