/**
 * Telegram Login Widget hash + OIDC claim mapping golden tests
 * Truth lens: telegram_login_widget_specialist
 */
import { describe, it, expect } from '@jest/globals'
import crypto from 'crypto'
import {
  buildTelegramWidgetDataCheckString,
  isTelegramWidgetAuthDateFresh,
  verifyTelegramLoginWidgetHash,
  type TelegramWidgetAuthPayload,
} from '@/lib/auth/telegram-login-widget-hash'
import {
  mapTelegramClaimsToProfile,
  normalizeTelegramAccountId,
  type TelegramIdTokenClaims,
} from '@/lib/auth/telegram-oidc'

/** Build a valid widget payload hash for a known bot token (test-only). */
function signWidgetPayload(
  fields: Omit<TelegramWidgetAuthPayload, 'hash'>,
  botToken: string,
): TelegramWidgetAuthPayload {
  const dataCheckString = buildTelegramWidgetDataCheckString(fields)
  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  return { ...fields, hash }
}

describe('Telegram Login Widget hash', () => {
  const botToken = '123456:ABC-DEF_test_token_for_hash_vectors'

  it('accepts a correctly signed payload', () => {
    const authDate = String(Math.floor(Date.now() / 1000))
    const payload = signWidgetPayload(
      {
        id: '987654321',
        first_name: 'Ada',
        username: 'ada',
        auth_date: authDate,
      },
      botToken,
    )
    expect(verifyTelegramLoginWidgetHash(payload, botToken)).toBe(true)
  })

  it('rejects tampered id', () => {
    const authDate = String(Math.floor(Date.now() / 1000))
    const payload = signWidgetPayload(
      {
        id: '987654321',
        first_name: 'Ada',
        auth_date: authDate,
      },
      botToken,
    )
    expect(
      verifyTelegramLoginWidgetHash({ ...payload, id: '111' }, botToken),
    ).toBe(false)
  })

  it('rejects wrong bot token', () => {
    const authDate = String(Math.floor(Date.now() / 1000))
    const payload = signWidgetPayload(
      {
        id: '1',
        auth_date: authDate,
      },
      botToken,
    )
    expect(verifyTelegramLoginWidgetHash(payload, 'other:token')).toBe(false)
  })

  it('rejects empty hash / token', () => {
    expect(
      verifyTelegramLoginWidgetHash(
        { id: '1', auth_date: '1', hash: '' },
        botToken,
      ),
    ).toBe(false)
    expect(
      verifyTelegramLoginWidgetHash(
        { id: '1', auth_date: '1', hash: 'abcd' },
        '',
      ),
    ).toBe(false)
  })

  it('omits absent optional fields from data_check_string', () => {
    const withOptional = buildTelegramWidgetDataCheckString({
      id: '1',
      first_name: 'A',
      last_name: undefined,
      username: '',
      auth_date: '1700000000',
    })
    expect(withOptional).toBe('auth_date=1700000000\nfirst_name=A\nid=1')
  })

  it('enforces auth_date freshness window', () => {
    const now = 1_700_000_000
    expect(isTelegramWidgetAuthDateFresh(now - 100, 86400, now)).toBe(true)
    expect(isTelegramWidgetAuthDateFresh(now - 90_000, 86400, now)).toBe(false)
    expect(isTelegramWidgetAuthDateFresh('0', 86400, now)).toBe(false)
  })
})

describe('Telegram OIDC claim mapping', () => {
  it('maps id_token claims to profile (sub fallback)', () => {
    const claims: TelegramIdTokenClaims = {
      iss: 'https://oauth.telegram.org',
      aud: '123456789',
      sub: '987654321',
      iat: 1700000000,
      exp: 1700003600,
      name: 'John Doe',
      preferred_username: 'johndoe',
      picture: 'https://cdn.example/photo.jpg',
    }
    const profile = mapTelegramClaimsToProfile(claims)
    expect(profile.telegramId).toBe('987654321')
    expect(profile.id).toBe('987654321')
    expect(profile.name).toBe('John Doe')
    expect(profile.username).toBe('johndoe')
    expect(profile.email).toBeNull()
    expect(profile.image).toBe('https://cdn.example/photo.jpg')
  })

  it('prefers numeric id claim over sub when both present', () => {
    const profile = mapTelegramClaimsToProfile({
      sub: 'sub-only',
      id: 4242,
      given_name: 'Ada',
      family_name: 'Lovelace',
    })
    expect(profile.telegramId).toBe('4242')
    expect(profile.name).toBe('Ada Lovelace')
  })

  it('normalizes account ids', () => {
    expect(normalizeTelegramAccountId(42)).toBe('42')
    expect(normalizeTelegramAccountId('  99  ')).toBe('99')
    expect(normalizeTelegramAccountId(null)).toBe('')
  })
})
