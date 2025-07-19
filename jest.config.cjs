const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Enhanced Jest config for React 19 testing with TypeScript lenient mode
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'features/**/*.{js,jsx,ts,tsx}',
    'hooks/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  testTimeout: 10000,
  // React 19 specific configurations with TypeScript lenient mode
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { 
      presets: ['next/babel'],
      // Disable TypeScript type checking during tests
      env: {
        test: {
          presets: [
            ['next/babel', { 'preset-typescript': { allowNamespaces: true } }]
          ]
        }
      }
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(react|react-dom)/)',
  ],
  // Mock Next.js server environment
  setupFiles: ['<rootDir>/jest.globals.ts'],
  // TypeScript handling for tests
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        compilerOptions: {
          strict: false,
          noImplicitAny: false,
          skipLibCheck: true,
        }
      }
    }
  }
}

// Export with Next.js integration for React 19 support
module.exports = createJestConfig(customJestConfig)