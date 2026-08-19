import { createRequire } from 'module';
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'node:fs'
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readOverlayBuild() {
  const fromEnv = (process.env.NEXT_PUBLIC_RING_OVERLAY_VERSION || '').trim()
  if (/^[0-9]+$/.test(fromEnv)) return fromEnv
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.ring-overlay-version'), 'utf8').trim()
    if (/^[0-9]+$/.test(raw)) return raw
  } catch {
    /* bare L1 has no overlay file */
  }
  return '0'
}

const RING_OVERLAY_BUILD = readOverlayBuild()

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
  // Custom server uses hostname `localhost`; Cursor/Simple Browser often open 127.0.0.1.
  // Without this, Next 16 blocks the cross-origin dev / RSC payload → dead SSR chrome
  // (desktop sidebar stuck on overlay rail with only "EN $").
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
    RING_DEPLOY_TARGET: process.env.RING_DEPLOY_TARGET,
    NEXT_PUBLIC_RING_DEPLOY_TARGET: process.env.NEXT_PUBLIC_RING_DEPLOY_TARGET,
    NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED: process.env.NEXT_PUBLIC_TUNNEL_WEBSOCKET_ENABLED,
    NEXT_PUBLIC_RING_OVERLAY_VERSION: RING_OVERLAY_BUILD,
  },
  async redirects() {
    return buildDocsUrlRedirects()
  },
  async rewrites() {
    // Serve KEYS collection metadata as application/json (avoid [locale]/[username] HTML catch-all).
    // Docs agent payloads: /docs/.../nodus.json and /docs/....md (never 301 .md — .mdx strip stays redirects).
    return [
      {
        source: '/nft/gates/collection.json',
        destination: '/api/nft/gates/collection',
      },
      {
        source: '/docs/nodus.json',
        destination: '/api/docs/nodus/en',
      },
      {
        source: '/docs/:path*/nodus.json',
        destination: '/api/docs/nodus/en/:path*',
      },
      {
        source: '/:locale/docs/nodus.json',
        destination: '/api/docs/nodus/:locale',
      },
      {
        source: '/:locale/docs/:path*/nodus.json',
        destination: '/api/docs/nodus/:locale/:path*',
      },
      // Markdown twin (AWS/Mintlify-style). Root + nested; locale-prefixed.
      {
        source: '/docs.md',
        destination: '/api/docs/markdown/en',
      },
      {
        source: '/docs/:path*.md',
        destination: '/api/docs/markdown/en/:path*',
      },
      {
        source: '/:locale/docs.md',
        destination: '/api/docs/markdown/:locale',
      },
      {
        source: '/:locale/docs/:path*.md',
        destination: '/api/docs/markdown/:locale/:path*',
      },
      // News-station WP-style /news/{section}/{slug} → L1 /news/[slug]
      // (must not steal static news/category, news/categories, news/author).
      {
        source: '/:locale/news/:section((?!category|categories|author)[^/]+)/:slug',
        destination: '/:locale/news/:slug',
      },
    ]
  },
  async headers() {
    // SECURITY FIX: Restrict CORS to specific origins only
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_API_URL || 'https://ring-platform.org']
      : ['http://localhost:3000', 'http://localhost:3001']
    
    return [
      {
        // Allow Telegram Login library popups if used; Auth.js Telegram OIDC uses redirect.
        source: '/:locale/login',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        source: '/login',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
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
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, './'),
  serverExternalPackages: [
    'google-auth-library',
    'gaxios',
    'gtoken',
    '@solana/spl-token',
    '@solana/web3.js',
    'nodemailer',
    '@react-email/render',
    '@react-email/components',
  ],
  outputFileTracingIncludes: {
    '**/*': [
      './i18n/**/*',
      './locales/**/*',
      './docs/**/*',
      './ring-config.json',
      './ring-config.template.json',
      './server.ts',
      './server.js',
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'ring-platform.org', 'www.ring-platform.org'],
      bodySizeLimit: '2mb'
    },
  ...(process.env.SKIP_TYPE_CHECK === '1'
    ? {
        // Docker/Colima: keep concurrency low — 8 workers + 6GiB heap OOMs a 12GiB VM
        // during ~2k static pages (BuildKit RPC EOF / daemon crash).
        cpus: 2,
        staticGenerationMaxConcurrency: 2,
        staticGenerationMinPagesPerWorker: 25,
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