import {
  formatTelegramProfileLabel,
  isTelegramLinked,
  normalizeTelegramUsername,
} from '@/lib/auth/telegram-profile'

describe('telegram-profile identity SSOT', () => {
  it('treats only numeric telegramId as linked', () => {
    expect(isTelegramLinked({ telegramUsername: 'hacker' })).toBe(false)
    expect(isTelegramLinked({ telegramId: '12' })).toBe(false)
    expect(isTelegramLinked({ telegramId: '123456789' })).toBe(true)
  })

  it('prefers @username in display label when known', () => {
    expect(
      formatTelegramProfileLabel({
        telegramId: '123456789',
        telegramUsername: '@ray',
      }),
    ).toBe('@ray')
  })

  it('falls back to UID when username missing', () => {
    expect(
      formatTelegramProfileLabel({
        telegramId: '123456789',
        telegramUsername: '',
      }),
    ).toBe('ID 123456789')
  })

  it('normalizes username without @', () => {
    expect(normalizeTelegramUsername('@@ray')).toBe('ray')
  })
})
