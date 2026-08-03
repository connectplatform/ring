import crypto from 'crypto'
import {
  buildTelegramMiniAppDataCheckString,
  isTelegramMiniAppAuthDateFresh,
  parseTelegramInitData,
  verifyTelegramMiniAppInitData,
} from '@/lib/auth/telegram-miniapp-initdata'

function signInitData(fields: Record<string, string>, botToken: string): string {
  const withHashExcluded = { ...fields }
  delete withHashExcluded.hash
  const dataCheckString = buildTelegramMiniAppDataCheckString(withHashExcluded)
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
}

describe('Telegram Mini App initData HMAC', () => {
  const botToken = '123456:ABC-DEF'

  it('verifies a correctly signed initData payload', () => {
    const user = JSON.stringify({
      id: 42,
      first_name: 'Ray',
      username: 'ray',
    })
    const auth_date = String(Math.floor(Date.now() / 1000))
    const hash = signInitData({ user, auth_date }, botToken)
    const initData = new URLSearchParams({ user, auth_date, hash }).toString()

    const parsed = verifyTelegramMiniAppInitData(initData, botToken)
    expect(parsed).not.toBeNull()
    expect(parsed?.user?.id).toBe(42)
    expect(isTelegramMiniAppAuthDateFresh(parsed!.authDate)).toBe(true)
  })

  it('rejects tampered hash', () => {
    const user = JSON.stringify({ id: 1, first_name: 'X' })
    const auth_date = String(Math.floor(Date.now() / 1000))
    const hash = signInitData({ user, auth_date }, botToken)
    const initData = new URLSearchParams({
      user,
      auth_date,
      hash: hash.replace(/0/g, '1'),
    }).toString()

    expect(verifyTelegramMiniAppInitData(initData, botToken)).toBeNull()
  })

  it('parseTelegramInitData returns null without hash', () => {
    expect(parseTelegramInitData('auth_date=1&user=%7B%7D')).toBeNull()
  })
})
