/**
 * Ring Platform Portal Configuration
 * Central configuration for all portal features and integrations
 */

export const PORTAL_CONFIG = {
  name: 'Ring Platform Portal',
  version: '1.0.0',
  description: 'Central hub for Ring ecosystem - opportunities, marketplace, and networking',

  // Platform Settings
  platform: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://ringplatform.org',
    environment: process.env.NODE_ENV || 'development',
    debug: process.env.DEBUG_MODE === 'true',
  },

  // Feature Flags
  features: {
    opportunities: true,
    marketplace: true,
    documentation: true,
    networking: true,
    messaging: true,
    wallet: true,
    aiMatcher: true,
    web3Integration: true,
  },

  // Navigation Configuration
  navigation: {
    main: [
      { href: '/', label: 'Home', icon: 'Home', badge: null },
      { href: '/opportunities', label: 'Opportunities', icon: 'Briefcase', badge: '150+' },
      { href: '/marketplace', label: 'Marketplace', icon: 'Store', badge: '50+' },
      { href: '/docs', label: 'Documentation', icon: 'FileText', badge: '200+' },
      { href: '/entities', label: 'Networking', icon: 'Users', badge: '1000+' },
      { href: '/messages', label: 'Messages', icon: 'MessageSquare', badge: '3' },
      { href: '/wallet', label: 'Wallet', icon: 'Wallet', badge: null },
    ],
    footer: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
      { href: '/support', label: 'Support' },
    ],
  },

  // Token Configuration
  tokens: {
    jwt: {
      symbol: 'JWT',
      name: 'JWT Utility Token',
      decimals: 2,
      burnRate: 0.005, // 0.5% burn per transaction
      contractAddress: process.env.JWT_CONTRACT_ADDRESS,
    },
    ring: {
      symbol: 'RING',
      name: 'RING Governance Token',
      decimals: 2,
      totalSupply: 1000000, // 1M RING
      stakingAPY: 0.125, // 12.5%
      contractAddress: process.env.RING_CONTRACT_ADDRESS,
    },
  },

  // Payment Configuration
  payments: {
    wayforpay: {
      merchantId: process.env.WAYFORPAY_MERCHANT_ID,
      secretKey: process.env.WAYFORPAY_SECRET_KEY,
      apiUrl: process.env.WAYFORPAY_API_URL || 'https://api.wayforpay.com/api',
    },
    ring: {
      enabled: true,
      feePercentage: 0.02, // 2% platform fee
    },
  },

  // AI Configuration
  ai: {
    matcher: {
      enabled: true,
      apiEndpoint: process.env.AI_MATCHER_API_URL,
      apiKey: process.env.AI_MATCHER_API_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4-turbo-preview',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229',
    },
  },

  // Database Configuration
  database: {
    primary: {
      type: process.env.DB_TYPE || 'postgresql',
      url: process.env.DATABASE_URL,
    },
    fallback: {
      type: 'firebase',
      config: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      },
    },
  },

  // Real-time Configuration
  realtime: {
    websocket: {
      enabled: true,
      url: process.env.WS_URL || 'wss://api.ringplatform.org',
      heartbeatInterval: 30000, // 30 seconds
    },
    tunnel: {
      enabled: true,
      autoConnect: true,
      debug: process.env.DEBUG_MODE === 'true',
    },
  },

  // Web3 Configuration
  web3: {
    enabled: true,
    networks: {
      ethereum: {
        chainId: 1,
        rpcUrl: process.env.ETHEREUM_RPC_URL,
        blockExplorer: 'https://etherscan.io',
      },
      polygon: {
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL,
        blockExplorer: 'https://polygonscan.com',
      },
    },
    wallets: {
      metamask: true,
      walletconnect: true,
      coinbase: true,
      ringWallet: true,
    },
  },

  // File Storage Configuration
  storage: {
    primary: {
      provider: 'vercel-blob',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    },
    fallback: {
      provider: 'aws-s3',
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },

  // Analytics Configuration
  analytics: {
    enabled: true,
    providers: {
      google: {
        trackingId: process.env.GA_TRACKING_ID,
      },
      mixpanel: {
        token: process.env.MIXPANEL_TOKEN,
      },
      amplitude: {
        apiKey: process.env.AMPLITUDE_API_KEY,
      },
    },
  },

  // Security Configuration
  security: {
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
    cors: {
      origins: [
        'https://ringplatform.org',
        'https://www.ringplatform.org',
        'http://localhost:3000',
      ],
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY,
    },
  },

  // Email Configuration
  email: {
    provider: 'resend',
    apiKey: process.env.RESEND_API_KEY,
    from: 'noreply@ringplatform.org',
    templates: {
      welcome: 'welcome-template',
      verification: 'verification-template',
      notification: 'notification-template',
    },
  },

  // Notification Configuration
  notifications: {
    email: true,
    push: true,
    sms: false, // Disabled for now
    webhooks: {
      enabled: true,
      secret: process.env.WEBHOOK_SECRET,
    },
  },

  // Feature Limits (by user role)
  limits: {
    visitor: {
      opportunities: { view: true, apply: false },
      marketplace: { view: true, purchase: false },
      messages: { send: 5, receive: true },
      docs: { view: true, contribute: false },
    },
    member: {
      opportunities: { view: true, apply: true, post: false },
      marketplace: { view: true, purchase: true, sell: true },
      messages: { send: 50, receive: true },
      docs: { view: true, contribute: true },
    },
    premium: {
      opportunities: { view: true, apply: true, post: true },
      marketplace: { view: true, purchase: true, sell: true },
      messages: { send: -1, receive: true }, // unlimited
      docs: { view: true, contribute: true, moderate: true },
    },
  },

  // UI Configuration
  ui: {
    theme: {
      primary: 'blue',
      secondary: 'green',
      accent: 'purple',
    },
    breakpoints: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    animations: {
      duration: 300,
      easing: 'ease-in-out',
    },
  },

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.ringplatform.org',
    timeout: 30000, // 30 seconds
    retries: 3,
    endpoints: {
      opportunities: '/api/opportunities',
      marketplace: '/api/marketplace',
      entities: '/api/entities',
      messages: '/api/messages',
      wallet: '/api/wallet',
      docs: '/api/docs',
    },
  },

  // Monitoring Configuration
  monitoring: {
    enabled: true,
    sentry: {
      dsn: process.env.SENTRY_DSN,
    },
    datadog: {
      apiKey: process.env.DD_API_KEY,
      appKey: process.env.DD_APP_KEY,
    },
  },

  // Legal & Compliance
  legal: {
    gdpr: {
      enabled: true,
      consentRequired: true,
    },
    cookies: {
      essential: true,
      analytics: true,
      marketing: false,
    },
  },
} as const

export type PortalConfig = typeof PORTAL_CONFIG

// Helper functions
export const getFeatureFlag = (feature: keyof typeof PORTAL_CONFIG.features): boolean => {
  return PORTAL_CONFIG.features[feature]
}

export const getApiEndpoint = (endpoint: keyof typeof PORTAL_CONFIG.api.endpoints): string => {
  return `${PORTAL_CONFIG.api.baseUrl}${PORTAL_CONFIG.api.endpoints[endpoint]}`
}

export const getTokenConfig = (token: 'jwt' | 'ring') => {
  return PORTAL_CONFIG.tokens[token]
}

export const getUserLimits = (role: keyof typeof PORTAL_CONFIG.limits) => {
  return PORTAL_CONFIG.limits[role]
}

export default PORTAL_CONFIG
