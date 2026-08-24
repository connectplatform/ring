import {
  RFC8058_DEFAULT_ALLOW_HOSTS,
  assertRfc8058Target,
  extractUnsubscribeHeaders,
  hostMatchesAllowlist,
  isPrivateAddress,
  isUnsubscribeUrlAllowlisted,
  postRfc8058Unsubscribe,
} from '@/features/email-crm/lib/unsubscribe-rfc8058'

const ALLOW = [...RFC8058_DEFAULT_ALLOW_HOSTS]
const MAILCHIMP =
  'https://us21.list-manage.com/unsubscribe?u=abc&id=def'

function stubResponse(status: number, headers: Record<string, string> = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )
  return {
    status,
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
    },
    body: null,
  }
}

describe('extractUnsubscribeHeaders', () => {
  it('sets oneClick only for HTTPS List-Unsubscribe + One-Click Post header', () => {
    const parsed = extractUnsubscribeHeaders(
      {
        'List-Unsubscribe': `<${MAILCHIMP}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ''
    )
    expect(parsed.unsubscribeUrl).toBe(MAILCHIMP)
    expect(parsed.oneClick).toBe(true)
  })

  it('does not set oneClick for body-only URLs', () => {
    const parsed = extractUnsubscribeHeaders(
      {},
      'Please visit https://evil.example/unsubscribe/now'
    )
    expect(parsed.unsubscribeUrl).toContain('unsubscribe')
    expect(parsed.oneClick).toBe(false)
  })

  it('does not set oneClick for HTTP header URLs', () => {
    const parsed = extractUnsubscribeHeaders(
      {
        'List-Unsubscribe': '<http://us21.list-manage.com/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ''
    )
    expect(parsed.oneClick).toBe(false)
  })

  it('prefers HTTPS over HTTP in the same header', () => {
    const parsed = extractUnsubscribeHeaders(
      {
        'List-Unsubscribe':
          '<mailto:unsub@example.com>, <https://us21.list-manage.com/unsub>, <http://legacy.example/unsub>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ''
    )
    expect(parsed.unsubscribeUrl).toBe('https://us21.list-manage.com/unsub')
    expect(parsed.oneClick).toBe(true)
  })
})

describe('ESP allowlist', () => {
  it('matches registrable host suffixes', () => {
    expect(hostMatchesAllowlist('us21.list-manage.com', ALLOW)).toBe(true)
    expect(hostMatchesAllowlist('list-manage.com', ALLOW)).toBe(true)
    expect(hostMatchesAllowlist('click.mailchimp.com', ALLOW)).toBe(true)
    expect(hostMatchesAllowlist('evil.example', ALLOW)).toBe(false)
    expect(hostMatchesAllowlist('list-manage.com.evil.example', ALLOW)).toBe(false)
  })

  it('requires https for URL allowlist', () => {
    expect(isUnsubscribeUrlAllowlisted(MAILCHIMP, ALLOW)).toBe(true)
    expect(isUnsubscribeUrlAllowlisted('http://us21.list-manage.com/unsub', ALLOW)).toBe(false)
  })
})

describe('SSRF guards', () => {
  const lookup = jest.fn(async () => [{ address: '1.1.1.1', family: 4 }])

  beforeEach(() => {
    lookup.mockReset()
    lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
  })

  it('rejects loopback, RFC1918, and link-local addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true)
    expect(isPrivateAddress('10.0.0.8')).toBe(true)
    expect(isPrivateAddress('192.168.1.1')).toBe(true)
    expect(isPrivateAddress('169.254.169.254')).toBe(true)
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('1.1.1.1')).toBe(false)
  })

  it('rejects http, userinfo, and private IP hostnames without DNS', async () => {
    await expect(
      assertRfc8058Target('http://us21.list-manage.com/unsub', { allowHosts: ALLOW, lookup })
    ).rejects.toThrow(/HTTPS/)
    await expect(
      assertRfc8058Target('https://user:pass@us21.list-manage.com/unsub', {
        allowHosts: ALLOW,
        lookup,
      })
    ).rejects.toThrow(/userinfo/)
    await expect(
      assertRfc8058Target('https://127.0.0.1/unsub', { allowHosts: ALLOW, lookup })
    ).rejects.toThrow(/allowlist|private/i)
  })

  it('rejects hosts that resolve to a private address', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }])
    await expect(
      assertRfc8058Target(MAILCHIMP, { allowHosts: ALLOW, lookup })
    ).rejects.toThrow(/private address/)
  })

  it('does not follow redirects off-allowlist', async () => {
    const fetchImpl = jest.fn(async () =>
      stubResponse(302, { location: 'https://169.254.169.254/latest/meta-data/' })
    )
    const result = await postRfc8058Unsubscribe(MAILCHIMP, {
      allowHosts: ALLOW,
      lookup,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.status).toBe('error')
    expect(result.error).toMatch(/allowlist|private/i)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('POSTs List-Unsubscribe=One-Click on allowlisted HTTPS', async () => {
    const fetchImpl = jest.fn(async () => stubResponse(200))
    const result = await postRfc8058Unsubscribe(MAILCHIMP, {
      allowHosts: ALLOW,
      lookup,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result.status).toBe('ok')
    expect(result.httpStatus).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('manual')
    expect(init.body).toBe('List-Unsubscribe=One-Click')
  })
})
