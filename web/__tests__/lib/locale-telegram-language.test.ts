import { describe, expect, it } from '@jest/globals'
import { localeFromTelegramLanguageCode } from '@/lib/locale-config'

describe('localeFromTelegramLanguageCode', () => {
  it('maps ISO codes and Ukrainian aliases onto Ring locales', () => {
    expect(localeFromTelegramLanguageCode('uk')).toBe('uk')
    expect(localeFromTelegramLanguageCode('uk-UA')).toBe('uk')
    expect(localeFromTelegramLanguageCode('ua')).toBe('uk')
    expect(localeFromTelegramLanguageCode('ru')).toBe('ru')
    expect(localeFromTelegramLanguageCode('en-US')).toBe('en')
    expect(localeFromTelegramLanguageCode('es')).toBe('es')
    expect(localeFromTelegramLanguageCode('de')).toBe('de')
  })

  it('returns null for empty or unsupported Telegram languages', () => {
    expect(localeFromTelegramLanguageCode('')).toBe(null)
    expect(localeFromTelegramLanguageCode(null)).toBe(null)
    expect(localeFromTelegramLanguageCode('fr')).toBe(null)
  })
})
