import { ensureGlobal } from '@/features/email-crm/pipeline/security/regexp-utils'

describe('ensureGlobal', () => {
  it('clones so sticky lastIndex cannot poison the next matchAll', () => {
    const re = /foo/g
    const first = ensureGlobal(re)
    expect([...('foo foo'.matchAll(first))]).toHaveLength(2)
    expect(re.lastIndex).toBe(0)

    const second = ensureGlobal(re)
    expect(second).not.toBe(re)
    expect(second).not.toBe(first)
    expect([...('foo'.matchAll(second))]).toHaveLength(1)
  })

  it('adds g when missing and preserves other flags', () => {
    const re = /bar/i
    const next = ensureGlobal(re)
    expect(next.flags).toContain('g')
    expect(next.flags).toContain('i')
    expect([...('Bar bar'.matchAll(next))]).toHaveLength(2)
  })
})
