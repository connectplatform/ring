import '@testing-library/jest-dom'

// React 19 testing setup with comprehensive utilities

// Mock IntersectionObserver for testing
const mockIntersectionObserver = jest.fn()
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
})

window.IntersectionObserver = mockIntersectionObserver
window.HTMLElement.prototype.scrollIntoView = jest.fn()

// Mock localStorage for testing
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock sessionStorage for testing
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
})

// Mock matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    entries: jest.fn(),
    forEach: jest.fn(),
    keys: jest.fn(),
    values: jest.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({}),
}))

// Mock NextAuth session
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: null,
    status: 'loading',
    update: jest.fn(),
  }),
  getSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getProviders: jest.fn(),
  getCsrfToken: jest.fn(),
}))

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  serverTimestamp: jest.fn(),
  onSnapshot: jest.fn(),
  connectFirestoreEmulator: jest.fn(),
}))

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  connectAuthEmulator: jest.fn(),
}))

// Mock Framer Motion
jest.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    span: 'span',
    button: 'button',
    form: 'form',
    input: 'input',
    textarea: 'textarea',
    select: 'select',
    option: 'option',
    label: 'label',
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    p: 'p',
    a: 'a',
    img: 'img',
    ul: 'ul',
    li: 'li',
    nav: 'nav',
    header: 'header',
    footer: 'footer',
    main: 'main',
    section: 'section',
    article: 'article',
    aside: 'aside',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({
    start: jest.fn(),
    stop: jest.fn(),
    set: jest.fn(),
  }),
  useMotionValue: () => ({
    get: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
  }),
}))

// Mock React 19 hooks for testing
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useActionState: jest.fn(() => [null, jest.fn(), false]),
  useFormStatus: jest.fn(() => ({
    pending: false,
    data: null,
    method: null,
    action: null,
  })),
  useTransition: jest.fn(() => [false, jest.fn()]),
  useDeferredValue: jest.fn((value) => value),
  useOptimistic: jest.fn((state) => [state, jest.fn()]),
  use: jest.fn(),
}))

// Custom matchers for testing
expect.extend({
  toHaveAccessibleName(received: HTMLElement, expected: string) {
    const accessibleName = received.getAttribute('aria-label') || 
                          received.getAttribute('aria-labelledby') ||
                          received.textContent ||
                          received.getAttribute('title') ||
                          received.getAttribute('alt')
    
    const pass = accessibleName === expected
    
    if (pass) {
      return {
        message: () => `expected ${received.tagName} not to have accessible name "${expected}"`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received.tagName} to have accessible name "${expected}", but got "${accessibleName}"`,
        pass: false,
      }
    }
  },

  toHaveErrorBoundary(received: HTMLElement) {
    const hasErrorBoundary = received.querySelector('[data-testid="error-boundary"]') !== null
    
    if (hasErrorBoundary) {
      return {
        message: () => `expected component not to have error boundary`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected component to have error boundary`,
        pass: false,
      }
    }
  },

  toHaveLoadingState(received: HTMLElement) {
    const hasLoadingState = received.querySelector('[data-testid="loading"]') !== null ||
                           received.querySelector('[aria-busy="true"]') !== null ||
                           received.textContent?.includes('Loading') ||
                           received.querySelector('.loading') !== null
    
    if (hasLoadingState) {
      return {
        message: () => `expected component not to have loading state`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected component to have loading state`,
        pass: false,
      }
    }
  },

  toHaveReactState(received: HTMLElement, stateName: string) {
    const hasState = received.getAttribute('data-state') === stateName ||
                    received.getAttribute('data-testid')?.includes(stateName)
    
    if (hasState) {
      return {
        message: () => `expected component not to have React state "${stateName}"`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected component to have React state "${stateName}"`,
        pass: false,
      }
    }
  },

  toHaveValidationError(received: HTMLElement, errorMessage?: string) {
    const hasValidationError = received.querySelector('[role="alert"]') !== null ||
                              received.querySelector('.error') !== null ||
                              received.getAttribute('aria-invalid') === 'true'
    
    if (errorMessage) {
      const hasSpecificError = received.textContent?.includes(errorMessage)
      if (hasValidationError && hasSpecificError) {
        return {
          message: () => `expected component not to have validation error "${errorMessage}"`,
          pass: true,
        }
      } else {
        return {
          message: () => `expected component to have validation error "${errorMessage}"`,
          pass: false,
        }
      }
    }
    
    if (hasValidationError) {
      return {
        message: () => `expected component not to have validation error`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected component to have validation error`,
        pass: false,
      }
    }
  },
})

// Extend Jest matchers interface
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveAccessibleName(expected: string): R
      toHaveErrorBoundary(): R
      toHaveLoadingState(): R
      toHaveReactState(stateName: string): R
      toHaveValidationError(errorMessage?: string): R
    }
  }
}

// Global test utilities
global.testUtils = {
  // Create mock user session
  createMockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    image: '/avatar.jpg',
    ...overrides,
  }),

  // Create mock Firebase document
  createMockFirebaseDoc: (data = {}) => ({
    id: 'test-doc-id',
    data: () => data,
    exists: () => true,
    ref: {
      path: 'test/path',
      id: 'test-doc-id',
    },
    ...data,
  }),

  // Create mock form data
  createMockFormData: (data: Record<string, string>) => {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value)
    })
    return formData
  },

  // Wait for async operations
  waitFor: async (fn: () => void, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const check = () => {
        try {
          fn()
          resolve(true)
        } catch (error) {
          if (Date.now() - startTime >= timeout) {
            reject(new Error(`Timeout after ${timeout}ms: ${error}`))
          } else {
            setTimeout(check, 100)
          }
        }
      }
      check()
    })
  },

  // Clear all mocks
  clearAllMocks: () => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
    mockLocalStorage.clear.mockClear()
    mockSessionStorage.getItem.mockClear()
    mockSessionStorage.setItem.mockClear()
    mockSessionStorage.removeItem.mockClear()
    mockSessionStorage.clear.mockClear()
  },
}

// Declare global test utils type
declare global {
  var testUtils: {
    createMockUser: (overrides?: Record<string, any>) => any
    createMockFirebaseDoc: (data?: Record<string, any>) => any
    createMockFormData: (data: Record<string, string>) => FormData
    waitFor: (fn: () => void, timeout?: number) => Promise<boolean>
    clearAllMocks: () => void
  }
}

// Console warnings filter for cleaner test output
const originalConsoleWarn = console.warn
console.warn = (...args) => {
  const message = args[0]
  
  // Filter out known React 19 warnings in tests
  if (
    typeof message === 'string' &&
    (message.includes('React.useLayoutEffect') ||
     message.includes('useLayoutEffect does nothing on the server') ||
     message.includes('Warning: Function components cannot be given refs'))
    ) {
      return
    }
  
  originalConsoleWarn(...args)
}

// Setup and teardown
beforeEach(() => {
  // Reset all mocks before each test
  global.testUtils.clearAllMocks()
  
  // Reset DOM
  document.body.innerHTML = ''
  
  // Reset timers
  jest.clearAllTimers()
})

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks()
  jest.clearAllTimers()
})