import React, { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import InstanceThemeStyle from '@/components/common/whitelabel/InstanceThemeStyle.server'
import '@/styles/globals.css'
import { SIDEBAR_ASIDE_DEFAULT, SIDEBAR_ASIDE_MAX, SIDEBAR_COOKIE_NAME } from '@/lib/sidebar-pref'
import { Inter } from 'next/font/google'
import {
  AppClientShell,
  AppShellStaticFallback,
} from '@/components/providers/app-client-shell'
import { getPublicInstanceConfig, getSiteBaseUrl } from '@/lib/ring-config-core'
import { auth } from '@/auth'
import type { PublicInstanceConfig } from '@/components/common/whitelabel/instance-config-client'
import {
  DEFAULT_LOCALE,
  getClientLocaleConfig,
  LEGACY_BROWSER_GATE,
  SUPPORTED_LOCALES,
} from '@/lib/locale-config'

// --- Pre-computed client config strings (inlined into beforeInteractive scripts) ---
const CLIENT_LOCALE_CONFIG = getClientLocaleConfig()
const CLIENT_LOCALE_CONFIG_JSON = JSON.stringify(CLIENT_LOCALE_CONFIG)
const LEGACY_BROWSER_GATE_JSON = JSON.stringify(LEGACY_BROWSER_GATE)
const SUPPORTED_LOCALE_PATTERN = SUPPORTED_LOCALES.join('|')

// --- Fonts ---
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  preload: true,
})

// --- Metadata ---
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrlSafe()),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  other: {
    'format-detection': 'telephone=no, date=no, address=no, email=no',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Safe URL construction for metadataBase — falls back to localhost in dev
function getSiteUrlSafe(): string {
  try {
    return getSiteBaseUrl() || 'http://localhost:3000'
  } catch {
    return 'http://localhost:3000'
  }
}

// --- Inline scripts (run before hydration, no React warning) ---

/**
 * Injects the locale config as a global so client code can read it without
 * a network round-trip. Using next/script with strategy="beforeInteractive"
 * ensures it runs before any hydration — no React 19 "script tag" warning.
 */
const LOCALE_CONFIG_SCRIPT = `window.__RING_LOCALE_CONFIG__=${CLIENT_LOCALE_CONFIG_JSON};`

/**
 * Reads the sidebar cookie (set by sidebar-rail.tsx) and sets the
 * `--sidebar-aside-w` CSS custom property before first paint — prevents
 * layout flash for users with a collapsed/wide sidebar.
 */
const SIDEBAR_COOKIE_SCRIPT = `(function(){try{var m=document.cookie.match(/${SIDEBAR_COOKIE_NAME}=([^;]+)/);if(!m)return;var s=JSON.parse(decodeURIComponent(m[1]));var w=s.collapsed?0:(typeof s.asideW==='number'?Math.min(${SIDEBAR_ASIDE_MAX},Math.max(0,s.asideW)):${SIDEBAR_ASIDE_DEFAULT});document.documentElement.style.setProperty('--sidebar-aside-w',w+'px');}catch(e){}})();`

/**
 * Legacy browser gate — detects ancient browsers and shows a friendly
 * "please upgrade" page in the user's locale. Should rarely trigger in 2026
 * but kept as a safety net for older devices.
 */
const LEGACY_BROWSER_SCRIPT = `
(function() {
  var isModernBrowser = (
    typeof globalThis !== 'undefined' &&
    typeof Promise !== 'undefined' &&
    Promise.allSettled &&
    typeof Symbol !== 'undefined' &&
    typeof Proxy !== 'undefined' &&
    typeof WeakMap !== 'undefined'
  );
  if (!isModernBrowser) {
    var cfg = window.__RING_LOCALE_CONFIG__ || { defaultLocale: '${DEFAULT_LOCALE}', supportedLocales: [] };
    var translations = ${LEGACY_BROWSER_GATE_JSON};
    var detectLocale = function() {
      var path = window.location.pathname;
      var match = path.match(new RegExp('^/(${SUPPORTED_LOCALE_PATTERN})(/|$)'));
      if (match && translations[match[1]]) return match[1];
      var stored = localStorage.getItem('ring-locale');
      if (stored && cfg.supportedLocales.indexOf(stored) >= 0) return stored;
      var browserLang = (navigator.language || cfg.defaultLocale).toLowerCase();
      for (var i = 0; i < cfg.supportedLocales.length; i++) {
        var code = cfg.supportedLocales[i];
        if (browserLang.indexOf(code) === 0) return code;
      }
      return cfg.defaultLocale;
    };
    var locale = detectLocale();
    var t = translations[locale] || translations[cfg.defaultLocale];
    document.addEventListener('DOMContentLoaded', function() {
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white">' +
          '<div style="max-width:600px;text-align:center;background:rgba(255,255,255,0.95);padding:40px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);color:#1a202c">' +
            '<div style="font-size:64px;margin-bottom:20px">🌐</div>' +
            '<h1 style="font-size:32px;font-weight:700;margin:0 0 16px 0;color:#2d3748">' + t.title + '</h1>' +
            '<p style="font-size:18px;line-height:1.6;margin:0 0 24px 0;color:#4a5568">' + t.description + '</p>' +
            '<div style="background:#f7fafc;padding:20px;border-radius:8px;margin-bottom:24px">' +
              '<p style="font-size:14px;font-weight:600;margin:0 0 12px 0;color:#2d3748">' + t.minimumRequirements + '</p>' +
              '<ul style="list-style:none;padding:0;margin:0;text-align:left;font-size:14px;color:#4a5568">' +
                '<li style="margin:8px 0">✅ ' + t.chrome + '</li>' +
                '<li style="margin:8px 0">✅ ' + t.safari + '</li>' +
                '<li style="margin:8px 0">✅ ' + t.firefox + '</li>' +
              '</ul>' +
            '</div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' +
              '<a href="https://www.google.com/chrome/" style="display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:8px;font-weight:600">' + t.downloadChrome + '</a>' +
              '<a href="https://www.mozilla.org/firefox/" style="display:inline-block;padding:12px 24px;background:#764ba2;color:white;text-decoration:none;border-radius:8px;font-weight:600">' + t.downloadFirefox + '</a>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
  }
})();
`

/**
 * Session hydrate must live *inside* `<Suspense>` — `auth()` calls
 * `connection()` (uncached). Awaiting it in RootLayout outside Suspense
 * triggers Next.js 16 Blocking Route on every page.
 */
async function AuthenticatedAppShell({
  instanceConfig,
  children,
}: {
  instanceConfig: PublicInstanceConfig
  children: React.ReactNode
}) {
  const session = await auth()
  let initialExchangeRates: Record<string, number> | null = null
  try {
    const { ensureFxFeedFresh, getExchangeRates } = await import('@/lib/ring-oracle')
    await ensureFxFeedFresh()
    initialExchangeRates = getExchangeRates()
  } catch {
    /* static ring-config rates still apply on client */
  }
  return (
    <AppClientShell
      instanceConfig={instanceConfig}
      session={session}
      initialExchangeRates={initialExchangeRates}
    >
      {children}
    </AppClientShell>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const instanceConfig = getPublicInstanceConfig()

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* SSR theme injection — prevents FOUC for dark/system theme */}
        <InstanceThemeStyle />

        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />

        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/*
         * Before-interactive scripts — run before React hydration.
         * Using next/script (<Script>) rather than raw <script> because
         * React 19 / Next.js 16 warns that raw <script> tags in RSC are
         * never executed on the client. Each <Script> needs a unique id.
         */}
        <Script
          id="ring-locale-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: LOCALE_CONFIG_SCRIPT }}
        />
        <Script
          id="ring-sidebar-cookie"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SIDEBAR_COOKIE_SCRIPT }}
        />
        <Script
          id="ring-legacy-browser-gate"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: LEGACY_BROWSER_SCRIPT }}
        />
      </head>
      <body className="font-inter antialiased">
        <Suspense fallback={<AppShellStaticFallback />}>
          <AuthenticatedAppShell instanceConfig={instanceConfig}>
            {children}
          </AuthenticatedAppShell>
        </Suspense>
      </body>
    </html>
  )
}