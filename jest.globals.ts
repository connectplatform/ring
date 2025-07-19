// Jest globals setup for Next.js server environment
import { TextEncoder, TextDecoder } from 'util'

// Mock Next.js server environment
Object.defineProperty(global, 'TextEncoder', {
  value: TextEncoder,
  writable: false,
})

Object.defineProperty(global, 'TextDecoder', {
  value: TextDecoder,
  writable: false,
})

// Mock Request and Response for server components
Object.defineProperty(global, 'Request', {
  value: class MockRequest {
    constructor(public url: string, public init?: RequestInit) {}
  },
  writable: false,
})

Object.defineProperty(global, 'Response', {
  value: class MockResponse {
    constructor(public body?: any, public init?: ResponseInit) {}
    static json(body: any) {
      return new MockResponse(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
  writable: false,
})

// Mock Headers for server components
Object.defineProperty(global, 'Headers', {
  value: class MockHeaders extends Map {
    constructor(init?: any) {
      super()
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.set(key, value as string)
        })
      }
    }
  },
  writable: false,
})

// Mock fetch for server components
Object.defineProperty(global, 'fetch', {
  value: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  ),
  writable: true,
})

// Mock crypto for Node.js environment
const mockCrypto = {
  randomUUID: () => 'test-uuid',
  randomBytes: (size: number) => Buffer.alloc(size),
  subtle: {
    digest: jest.fn(),
  },
}

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: false,
})

// Mock next/server
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(public url: string, public init?: any) {}
  },
  NextResponse: class MockNextResponse {
    static json(body: any) {
      return { body: JSON.stringify(body) }
    }
  },
}))

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.FIREBASE_PROJECT_ID = 'test-project'
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com'
process.env.FIREBASE_PRIVATE_KEY = 'test-key' 