import React, { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import InstanceThemeStyle from '@/components/common/whitelabel/InstanceThemeStyle.server'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import {
  AppClientShell,
  AppShellStaticFallback,
} from '@/components/providers/app-client-shell'
import { getPublicInstanceConfig } from '@/lib/instance-config'
import {
  DEFAULT_LOCALE,
  getClientLocaleConfig,
  LEGACY_BROWSER_GATE,
  SUPPORTED_LOCALES,
} from '@/lib/locale-config'

const CLIENT_LOCALE_CONFIG = getClientLocaleConfig()
const LEGACY_BROWSER_GATE_JSON = JSON.stringify(LEGACY_BROWSER_GATE)
const CLIENT_LOCALE_CONFIG_JSON = JSON.stringify(CLIENT_LOCALE_CONFIG)
const SUPPORTED_LOCALE_PATTERN = SUPPORTED_LOCALES.join('|')

// Suppress known third-party library warnings
import '@/lib/suppress-warnings'

// React 19 Resource Preloading APIs
import { setupResourcePreloading } from '@/lib/preload/setup'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'], // Only load weights that are actually used
  variable: '--font-inter',
  preload: true, // Enable preload for critical fonts
})

export const metadata: Metadata = {
  other: {
    'format-detection': 'telephone=no, date=no, address=no, email=no',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  setupResourcePreloading()
  const instanceConfig = getPublicInstanceConfig()

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <InstanceThemeStyle />

        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />

        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        {/* PWA manifest - uncomment when manifest.json is created */}
        {/* <link rel="manifest" href="/manifest.json" /> */}

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RING_LOCALE_CONFIG__=${CLIENT_LOCALE_CONFIG_JSON};`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
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
        `,
          }}
        />
      </head>
      <body className="font-inter antialiased">
        <Suspense fallback={<AppShellStaticFallback />}>
          <AppClientShell instanceConfig={instanceConfig}>{children}</AppClientShell>
        </Suspense>
      </body>
    </html>
  )
}