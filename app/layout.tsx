import React from 'react'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { SessionProvider } from '@/features/auth/components/session-provider'
import { CreditBalanceProvider } from '@/components/providers/credit-balance-provider'
import { FCMProvider, FCMPermissionPrompt } from '@/components/providers/fcm-provider'
import { WebVitalsProvider } from '@/components/providers/web-vitals-provider'
import { TunnelProvider } from '@/components/providers/tunnel-provider'
import InstanceThemeStyle from '@/components/common/whitelabel/InstanceThemeStyle.server'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { AppProvider } from '@/contexts/app-context'
import InstanceConfigProvider from '@/components/providers/instance-config-provider'
import { StoreProvider } from '@/features/store/context'
import { CurrencyProvider } from '@/features/store/currency-context'
// import { WebSocketDiagnosticsProvider } from '@/components/providers/websocket-diagnostics-provider' // DISABLED per Emperor's command
import GoogleOneTap from '@/features/auth/components/google-one-tap'
import { GoogleOAuthProvider } from '@react-oauth/google'
// Dynamic import for Web3Provider to reduce initial bundle size
// Web3 libraries are large (Wagmi + RainbowKit + WalletConnect = ~500KB)
// This improves First Contentful Paint (FCP) and Time to Interactive (TTI)
import dynamic from 'next/dynamic'

const Web3Provider = dynamic(
  () => import('@/providers/web3-provider').then(mod => ({ default: mod.Web3Provider })),
  {
    ssr: true, // Enable SSR for SEO and hydration
    loading: () => null // No loading state needed (invisible provider)
  }
)

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

// Root layout doesn't need page-specific metadata
// Each page will provide its own using React 19 native metadata

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // React 19 Resource Preloading - Critical Performance Optimization
  setupResourcePreloading()
  
  // Next.js 16 + cacheComponents: SessionProvider fetches session client-side
  // Removing server-side auth() call enables static shell streaming for all routes

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <InstanceThemeStyle />

        {/* React 19 Enhanced Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="light dark" />

        {/* Performance hints */}
        <meta httpEquiv="x-dns-prefetch-control" content="on" />

        {/* PWA manifest - uncomment when manifest.json is created */}
        {/* <link rel="manifest" href="/manifest.json" /> */}

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Browser Compatibility Detection - Requires Chrome 111+, Safari 16.4+, Firefox 109+ (Multilingual) */}
        <script dangerouslySetInnerHTML={{__html: `
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
              // Translations for browser compatibility message
              var translations = {
                en: {
                  title: 'Browser Update Required',
                  description: 'Ring Platform requires a modern browser to provide you with the best experience.',
                  minimumRequirements: 'Minimum Requirements:',
                  chrome: 'Chrome/Edge 111+ (March 2023)',
                  safari: 'Safari 16.4+ (March 2023)',
                  firefox: 'Firefox 109+ (January 2023)',
                  downloadChrome: 'Download Chrome',
                  downloadFirefox: 'Download Firefox'
                },
                uk: {
                  title: 'Потрібне оновлення браузера',
                  description: 'Платформа Ring потребує сучасного браузера для найкращого досвіду використання.',
                  minimumRequirements: 'Мінімальні вимоги:',
                  chrome: 'Chrome/Edge 111+ (березень 2023)',
                  safari: 'Safari 16.4+ (березень 2023)',
                  firefox: 'Firefox 109+ (січень 2023)',
                  downloadChrome: 'Завантажити Chrome',
                  downloadFirefox: 'Завантажити Firefox'
                },
                ru: {
                  title: 'Требуется обновление браузера',
                  description: 'Платформа Ring требует современного браузера для наилучшего опыта использования.',
                  minimumRequirements: 'Минимальные требования:',
                  chrome: 'Chrome/Edge 111+ (март 2023)',
                  safari: 'Safari 16.4+ (март 2023)',
                  firefox: 'Firefox 109+ (январь 2023)',
                  downloadChrome: 'Скачать Chrome',
                  downloadFirefox: 'Скачать Firefox'
                }
              };
              
              // Detect locale from URL path (e.g., /uk/about or /en/) or fallback to browser language
              var detectLocale = function() {
                var path = window.location.pathname;
                var match = path.match(/^\\/([a-z]{2})\\//);
                if (match && translations[match[1]]) return match[1];
                
                var browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
                if (browserLang.startsWith('uk')) return 'uk';
                if (browserLang.startsWith('ru')) return 'ru';
                return 'en';
              };
              
              var locale = detectLocale();
              var t = translations[locale];
              
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
                        '<a href="https://www.google.com/chrome/" style="display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:8px;font-weight:600;transition:transform 0.2s" onmouseover="this.style.transform=\\'scale(1.05)\\'" onmouseout="this.style.transform=\\'scale(1)\\'">' + t.downloadChrome + '</a>' +
                        '<a href="https://www.mozilla.org/firefox/" style="display:inline-block;padding:12px 24px;background:#764ba2;color:white;text-decoration:none;border-radius:8px;font-weight:600;transition:transform 0.2s" onmouseover="this.style.transform=\\'scale(1.05)\\'" onmouseout="this.style.transform=\\'scale(1)\\'">' + t.downloadFirefox + '</a>' +
                      '</div>' +
                    '</div>' +
                  '</div>';
              });
            }
          })();
        `}} />
      </head>
      <body className="font-inter antialiased">
      <SessionProvider>
        <CreditBalanceProvider>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          <Web3Provider>
          <WebVitalsProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <InstanceConfigProvider>
              <AppProvider>
                <FCMProvider>
                  <TunnelProvider autoConnect={false} debug={false}>
                    <CurrencyProvider>
                      <StoreProvider>
                        {children}

                        {/* Google One Tap - Shows for visitors, hidden on login pages and when auth modals are open */}
                        <GoogleOneTap />
                      </StoreProvider>
                    </CurrencyProvider>
                    {/* Removed transition overlay to prevent color banding/stripes during theme switch */}
                    <FCMPermissionPrompt />
                    <Toaster />
                    {/* WebSocket Diagnostics Panel (enable manually in development if needed) */}
                    {/* <WebSocketDiagnosticsProvider /> */}
                  </TunnelProvider>
                </FCMProvider>
              </AppProvider>
              </InstanceConfigProvider>
            </ThemeProvider>
          </WebVitalsProvider>
        </Web3Provider>
        </GoogleOAuthProvider>
        </CreditBalanceProvider>
      </SessionProvider>
      </body>
    </html>
  )
}