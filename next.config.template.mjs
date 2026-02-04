// =============================================================================
// Ring Platform - Next.js Configuration Template
// =============================================================================
// USAGE: Copy this file to next.config.mjs and customize for your Ring clone
//
// Replace the following placeholders:
// - YOUR_PRODUCTION_DOMAIN: Your production domain (e.g., app.greenfood.live)
// - YOUR_CDN_DOMAIN: Your CDN domain for static assets
// - YOUR_BLOB_STORAGE_DOMAIN: Your Vercel Blob storage domain
//
// =============================================================================

import { createRequire } from 'module';
import { fileURLToPath } from 'url'
import path from 'path'
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // ==========================================================================
    // Public environment variables (exposed to client)
    // ==========================================================================
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    
    // Firebase Client SDK (public, safe for client-side)
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    
    // ==========================================================================
    // Server-side environment variables (never exposed to client)
    // ==========================================================================
    // Firebase Admin SDK
    AUTH_FIREBASE_PROJECT_ID: process.env.AUTH_FIREBASE_PROJECT_ID,
    AUTH_FIREBASE_CLIENT_EMAIL: process.env.AUTH_FIREBASE_CLIENT_EMAIL,
    AUTH_FIREBASE_PRIVATE_KEY: process.env.AUTH_FIREBASE_PRIVATE_KEY,
    
    // Storage
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    
    // Auth.js Configuration
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    
    // OAuth Providers
    AUTH_APPLE_ID: process.env.AUTH_APPLE_ID,
    AUTH_APPLE_SECRET: process.env.AUTH_APPLE_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    NEXT_PUBLIC_AUTH_GOOGLE_ID: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID || process.env.AUTH_GOOGLE_ID,
    
    // Email Provider
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
  },
  async headers() {
    // ==========================================================================
    // SECURITY: CORS Configuration
    // ==========================================================================
    // IMPORTANT: Update allowedOrigins with your actual production domains
    // Never use wildcards (*) in production!
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_API_URL || 'https://YOUR_PRODUCTION_DOMAIN'] 
      : ['http://localhost:3000', 'http://localhost:3001']
    
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins[0] },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          // Security headers
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
      // ==========================================================================
      // Image Domains Configuration
      // ==========================================================================
      // Add your own domains for user avatars, product images, etc.
      // Google user avatars (for Google OAuth)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      
      // Your CDN domain (replace with your actual CDN)
      { protocol: 'https', hostname: 'YOUR_CDN_DOMAIN' },
      
      // Vercel Blob Storage (replace with your Blob storage domain)
      { protocol: 'https', hostname: 'YOUR_BLOB_STORAGE_DOMAIN.public.blob.vercel-storage.com' },
      
      // Google Fonts (for custom fonts)
      { protocol: 'https', hostname: 'fonts.googleapis.com' },
      { protocol: 'https', hostname: 'fonts.gstatic.com' },
      
      // Placeholder for development
      { protocol: 'https', hostname: 'example.com' },
      
      // Your production CDN (replace with your domain)
      { protocol: 'https', hostname: 'cdn.YOUR_PRODUCTION_DOMAIN' }
    ],
    // Image optimization settings
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
    loader: 'default',
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  webpack: (config, { isServer }) => {
    // Suppress optional dependency warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Module not found: Can't resolve '@supabase\/supabase-js'/,
      /Module not found: Can't resolve '@react-native-async-storage\/async-storage'/,
      /Module not found: Can't resolve 'pino-pretty'/,
    ];

    config.stats = {
      ...config.stats,
      warningsFilter: [
        /@supabase\/supabase-js/,
        /@react-native-async-storage\/async-storage/,
        /pino-pretty/,
      ],
    };

    if (!isServer) {
      // Client-side polyfills for Web3 libraries
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        child_process: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util/'),
        process: require.resolve('process/browser'),
        events: require.resolve('events/'),
      }
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      'node:events': 'events',
      'node:stream': 'stream-browserify',
      'node:util': 'util',
      'bert-js': path.resolve(__dirname, 'lib/shims/bert-js.js')
    };
    
    return config
  },
  transpilePackages: [
    'firebase', 
    '@firebase/auth', 
    '@firebase/firestore',
    'next-auth',
    '@auth/core',
    '@auth/firebase-adapter'
  ],
  serverRuntimeConfig: {
    PROJECT_ROOT: process.cwd()
  },
  output: 'standalone',
  outputFileTracingIncludes: {
    '**/*': ['./lib/**/*', './server.js']
  },
  experimental: {
    serverActions: {
      // ==========================================================================
      // Server Actions Configuration
      // ==========================================================================
      // Add your production domains here for Server Actions
      allowedOrigins: ['localhost:3000', 'YOUR_PRODUCTION_DOMAIN'],
      bodySizeLimit: '2mb'
    }
  },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'].filter(extension => {
    return !(extension.startsWith('my-docs/'));
  }),
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

export default withBundleAnalyzer(nextConfig);
