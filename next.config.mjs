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
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
  },
  async headers() {
    // SECURITY FIX: Restrict CORS to specific origins only
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.NEXT_PUBLIC_API_URL || 'https://myri.ng'] // Replace with your production domain
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
      { protocol: 'https', hostname: 'static.ring.ck.ua' },
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
  webpack: (config, { isServer }) => {
    // Suppress module resolution warnings for optional dependencies
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Module not found: Can't resolve '@supabase\/supabase-js'/,
      /Can't resolve '@supabase\/supabase-js'/,
      /@supabase\/supabase-js/,
      /Module not found: Can't resolve '@react-native-async-storage\/async-storage'/,
      /Can't resolve '@react-native-async-storage\/async-storage'/,
      /@react-native-async-storage\/async-storage/,
      /Module not found: Can't resolve 'pino-pretty'/,
      /Can't resolve 'pino-pretty'/,
      /pino-pretty/,
    ];

    // Suppress module resolution warnings for optional dependencies
    config.stats = {
      ...config.stats,
      warningsFilter: [
        /Module not found: Can't resolve '@supabase\/supabase-js'/,
        /Can't resolve '@supabase\/supabase-js'/,
        /@supabase\/supabase-js/,
        /Module not found: Can't resolve '@react-native-async-storage\/async-storage'/,
        /Can't resolve '@react-native-async-storage\/async-storage'/,
        /@react-native-async-storage\/async-storage/,
        /Module not found: Can't resolve 'pino-pretty'/,
        /Can't resolve 'pino-pretty'/,
        /pino-pretty/,
      ],
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        child_process: false,
        // Keep only essentials for web3 libs when dynamically imported
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
      // Provide a stub for bert-js to allow builds without native dep
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
      allowedOrigins: ['localhost:3000', 'ring.ck.ua', 'ring-platform.org', 'myri.ng'],
      bodySizeLimit: '2mb'
    }
  },
  // Exclude docs from build
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