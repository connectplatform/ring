import { createRequire } from 'module';
import { fileURLToPath } from 'url'
import path from 'path'
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config

const createNextIntlPlugin = require('next-intl/plugin')
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** Docs URL-shape normalizations (filesystem resolution stays in lib/docs/docs-path.ts). */
function buildDocsUrlRedirects() {
  const redirects = []
  const prefixedLocales = ['uk', 'ru']

  const addForBase = (base) => {
    redirects.push(
      {
        source: `${base}/:path*.mdx`,
        destination: `${base}/:path*`,
        permanent: true,
      },
      {
        source: `${base}/:path*/index`,
        destination: `${base}/:path*`,
        permanent: true,
      },
    )
  }

  // default locale (en) — localePrefix: 'as-needed'
  addForBase('/docs')
  for (const locale of prefixedLocales) {
    addForBase(`/${locale}/docs`)
  }

  return redirects
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    AUTH_FIREBASE_PROJECT_ID: process.env.AUTH_FIREBASE_PROJECT_ID,
    AUTH_FIREBASE_CLIENT_EMAIL: process.env.AUTH_FIREBASE_CLIENT_EMAIL,
    AUTH_FIREBASE_PRIVATE_KEY: process.env.AUTH_FIREBASE_PRIVATE_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    AUTH_APPLE_ID: process.env.AUTH_APPLE_ID,
    AUTH_APPLE_SECRET: process.env.AUTH_APPLE_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    NEXT_PUBLIC_AUTH_GOOGLE_ID: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID || process.env.AUTH_GOOGLE_ID,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
    RING_DEPLOY_TARGET: process.env.RING_DEPLOY_TARGET,
    NEXT_PUBLIC_RING_DEPLOY_TARGET: process.env.NEXT_PUBLIC_RING_DEPLOY_TARGET,
    NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED: process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED,
  },
  async redirects() {
    return buildDocsUrlRedirects()
  },
  async headers() {
    // SECURITY FIX: Restrict CORS to specific origins only
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_API_URL || 'https://ring-platform.org']
      : ['http://localhost:3000', 'http://localhost:3001']
    
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          // SECURITY: Dynamic origin based on environment - no wildcards!
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins[0] }, // Next.js doesn't support dynamic headers, use middleware for multiple origins
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          // Additional security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  staticPageGenerationTimeout: 180,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'x0kypqbqtr7wbl1a.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'fonts.googleapis.com' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
      { protocol: 'https', hostname: 'example.com' },
      { protocol: 'https', hostname: 'cdn.ring-platform.org' }
    ],
    // Configure image optimization behavior
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Disable image optimization for external domains to prevent infinite retries
    unoptimized: false,
    // Set loader to handle errors gracefully
    loader: 'default',
    // Configure image formats
    formats: ['image/webp', 'image/avif'],
    // Set device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Next.js 16: Turbopack config (replaces webpack resolve.alias & resolve.fallback)
  turbopack: {
    resolveAlias: {
      'crypto': { browser: 'crypto-browserify' },
      'stream': { browser: 'stream-browserify' },
      'util': { browser: 'util/' },
      'process': { browser: 'process/browser' },
      'events': { browser: 'events/' },
      'fs': { browser: './lib/shims/empty.ts' },
      'net': { browser: './lib/shims/empty.ts' },
      'tls': { browser: './lib/shims/empty.ts' },
      'http2': { browser: './lib/shims/empty.ts' },
      'child_process': { browser: './lib/shims/empty.ts' },
      'node:events': 'events',
      'node:stream': 'stream-browserify',
      'node:util': 'util',
      'bert-js': path.resolve(__dirname, 'lib/shims/bert-js.js'),
    },
  },
  transpilePackages: [
    'firebase', 
    '@firebase/auth', 
    '@firebase/firestore',
    'next-auth',
    '@auth/core',
    '@auth/firebase-adapter'
  ],
  // Note: serverRuntimeConfig removed in Next.js 16 - use process.env instead
  // Custom server (server.ts): omit standalone unless explicitly requested (e.g. legacy CI).
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1' ? { output: 'standalone' } : {}),
  ...(process.env.NEXT_OUTPUT_STANDALONE === '1'
    ? {
        outputFileTracingRoot: path.join(__dirname, './'),
        outputFileTracingIncludes: {
          '**/*': ['./i18n/**/*', './lib/**/*', './server.ts', './server.js'],
        },
      }
    : {}),
  serverExternalPackages: ['google-auth-library', 'gaxios', 'gtoken'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'ring-platform.org', 'www.ring-platform.org'],
      bodySizeLimit: '2mb'
    },
  ...(process.env.SKIP_TYPE_CHECK === '1'
    ? {
        cpus: 8,
        staticGenerationMaxConcurrency: 8,
        staticGenerationMinPagesPerWorker: 500,
      }
    : {}),
  },
  // Exclude docs from build
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].filter(extension => {
    return !(extension.startsWith('my-docs/'));
  }),
  typescript: {
    // CI runs `npm run type-check`; Docker/Colima builds set SKIP_TYPE_CHECK=1 to skip this phase and avoid OOM during cross-arch builds.
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === '1',
  },
  // Note: eslint config removed from next.config in Next.js 16 - use eslint CLI directly
}

export default withBundleAnalyzer(withNextIntl(nextConfig))