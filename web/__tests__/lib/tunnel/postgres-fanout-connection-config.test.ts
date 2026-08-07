/**
 * Connection config for tunnel fan-out LISTEN Client / NOTIFY queries.
 */

import { getTunnelFanoutPgConfig } from '@/lib/tunnel/hub/postgres-fanout/connection-config'

describe('getTunnelFanoutPgConfig', () => {
  const envKeys = [
    'DATABASE_URL',
    'DB_SSL',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ] as const
  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {}

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = saved[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('mirrors DatabaseService SSL when DB_SSL=true and DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgres://u:p@db:5432/ring'
    process.env.DB_SSL = 'true'
    expect(getTunnelFanoutPgConfig()).toEqual({
      connectionString: 'postgres://u:p@db:5432/ring',
      ssl: true,
    })
  })

  it('omits ssl when DB_SSL is not true', () => {
    process.env.DATABASE_URL = 'postgres://u:p@db:5432/ring'
    process.env.DB_SSL = 'false'
    expect(getTunnelFanoutPgConfig()).toEqual({
      connectionString: 'postgres://u:p@db:5432/ring',
    })
  })

  it('applies ssl to DB_* fallback config', () => {
    process.env.DB_HOST = 'pg.internal'
    process.env.DB_PORT = '5432'
    process.env.DB_NAME = 'ring_platform'
    process.env.DB_USER = 'ring'
    process.env.DB_PASSWORD = 'secret'
    process.env.DB_SSL = 'true'
    expect(getTunnelFanoutPgConfig()).toMatchObject({
      host: 'pg.internal',
      ssl: true,
    })
  })
})
