import { loadChangelog } from '@/lib/changelog/load-changelog'

describe('changelog JSON SSOT', () => {
  it('loads en changelog entries with date/version/mods', () => {
    const entries = loadChangelog('en')
    expect(entries.length).toBeGreaterThan(0)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        version: expect.any(String),
        mods: expect.arrayContaining([expect.any(String)]),
      }),
    )
  })

  it('falls back to en when locale file missing', () => {
    const entries = loadChangelog('es')
    expect(entries.length).toBeGreaterThan(0)
  })
})
