type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function format(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta || {}),
  }
  return JSON.stringify(payload)
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => console.debug(format('debug', message, meta)),
  info: (message: string, meta?: Record<string, unknown>) => console.info(format('info', message, meta)),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(format('warn', message, meta)),
  error: (message: string, meta?: Record<string, unknown>) => console.error(format('error', message, meta)),
}


