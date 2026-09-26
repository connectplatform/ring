import { describe, expect, it } from '@jest/globals'
import {
  isTelegramMiniAppFromSignals,
  isTelegramMiniAppPath,
  languageCodeFromTelegramInitData,
  languageCodeFromTelegramLocation,
} from '@/lib/browser/telegram-webapp'
import {
  cssVarsFromSafeArea,
  cssVarsFromThemeParams,
  isPeerGamesPath,
} from '@/lib/browser/telegram-mini-app-chrome'

const empty = {
  search: '',
  hash: '',
  hasTelegramWebviewHost: false,
  webApp: null as null,
}

describe('telegram-webapp Mini App detection', () => {
  it('matches locale-prefixed and bare /tg-mini-app paths', () => {
    expect(isTelegramMiniAppPath('/ru/tg-mini-app')).toBe(true)
    expect(isTelegramMiniAppPath('/tg-mini-app')).toBe(true)
    expect(isTelegramMiniAppPath('/en/tg-mini-app/')).toBe(true)
    expect(isTelegramMiniAppPath('/ru/n9')).toBe(false)
    expect(isTelegramMiniAppPath('/ru/today')).toBe(false)
  })

  it('treats Telegram WebView host objects as Mini App', () => {
    expect(
      isTelegramMiniAppFromSignals({
        ...empty,
        pathname: '/ru/n9',
        hasTelegramWebviewHost: true,
      }),
    ).toBe(true)
  })

  it('requires initData on Telegram.WebApp so the script tag in Safari is not Mini App', () => {
    expect(
      isTelegramMiniAppFromSignals({
        ...empty,
        pathname: '/ru/n9',
        webApp: { initData: '', platform: 'ios' },
      }),
    ).toBe(false)
    expect(
      isTelegramMiniAppFromSignals({
        ...empty,
        pathname: '/ru/n9',
        webApp: { initData: 'query_id=AAE&user=%7B%7D', platform: 'ios' },
      }),
    ).toBe(true)
  })

  it('reads Telegram start-param hash fragments', () => {
    expect(
      isTelegramMiniAppFromSignals({
        ...empty,
        pathname: '/ru/n9',
        hash: '#tgWebAppData=user',
      }),
    ).toBe(true)
  })

  it('parses language_code from initData user JSON and hash tgWebAppData', () => {
    const initData = 'user=%7B%22id%22%3A1%2C%22language_code%22%3A%22uk%22%7D&hash=abc'
    expect(languageCodeFromTelegramInitData(initData)).toBe('uk')
    expect(
      languageCodeFromTelegramLocation('', `#tgWebAppData=${encodeURIComponent(initData)}`),
    ).toBe('uk')
    expect(languageCodeFromTelegramInitData('hash=only')).toBe(null)
  })
})

describe('telegram Mini App chrome mappers', () => {
  it('maps themeParams onto --tg-theme-* and ignores invalid colors', () => {
    expect(
      cssVarsFromThemeParams({
        bg_color: '#1a1a1a',
        text_color: '#ffffff',
        hint_color: 'red',
        button_color: '#2481cc',
        secondary_bg_color: '#232e3c',
      }),
    ).toEqual({
      '--tg-theme-bg-color': '#1a1a1a',
      '--tg-theme-text-color': '#ffffff',
      '--tg-theme-button-color': '#2481cc',
      '--tg-theme-secondary-bg-color': '#232e3c',
    })
  })

  it('maps safe-area insets to pixel CSS variables', () => {
    expect(
      cssVarsFromSafeArea({ top: 47, bottom: 34, left: 0, right: 0 }, { top: 48, bottom: 0 }),
    ).toEqual({
      '--tg-safe-area-inset-top': '47px',
      '--tg-safe-area-inset-bottom': '34px',
      '--tg-safe-area-inset-left': '0px',
      '--tg-safe-area-inset-right': '0px',
      '--tg-content-safe-area-inset-top': '48px',
      '--tg-content-safe-area-inset-bottom': '0px',
    })
  })

  it('treats /games as peer-games so n9life BackButton does not steal it', () => {
    expect(isPeerGamesPath('/games')).toBe(true)
    expect(isPeerGamesPath('/games/abc')).toBe(true)
    expect(isPeerGamesPath('/en/games/abc')).toBe(true)
    expect(isPeerGamesPath('/ru/n9')).toBe(false)
    expect(isPeerGamesPath('/ru/chart')).toBe(false)
    expect(isPeerGamesPath('/chart')).toBe(false)
  })
})
