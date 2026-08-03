import {
  isOverlayPathAllowed,
  parseForgejoGitUrl,
} from '@/features/crm/lab/order-source-paths'

describe('parseForgejoGitUrl', () => {
  it('parses https url with .git', () => {
    expect(
      parseForgejoGitUrl('https://forge.ringdom.org/ringdom-clones/acme.git'),
    ).toEqual({
      owner: 'ringdom-clones',
      repo: 'acme',
      gitUrl: 'https://forge.ringdom.org/ringdom-clones/acme.git',
    })
  })

  it('parses https url without .git', () => {
    expect(
      parseForgejoGitUrl('https://forge.ringdom.org/ringdom-clones/acme'),
    ).toMatchObject({ owner: 'ringdom-clones', repo: 'acme' })
  })

  it('returns null for garbage', () => {
    expect(parseForgejoGitUrl('not-a-url')).toBeNull()
  })
})

describe('isOverlayPathAllowed', () => {
  it('allows scaffold exact files', () => {
    expect(isOverlayPathAllowed('ring-config.json')).toBe(true)
    expect(isOverlayPathAllowed('customization.json')).toBe(true)
    expect(isOverlayPathAllowed('.reggie-propagate-exclude.json')).toBe(true)
  })

  it('allows overlay prefixes', () => {
    expect(isOverlayPathAllowed('locales/en/common.json')).toBe(true)
    expect(isOverlayPathAllowed('messages/uk.json')).toBe(true)
    expect(isOverlayPathAllowed('overlays/brand.css')).toBe(true)
  })

  it('rejects traversal and absolute paths', () => {
    expect(isOverlayPathAllowed('../ring-config.json')).toBe(false)
    expect(isOverlayPathAllowed('/etc/passwd')).toBe(false)
    expect(isOverlayPathAllowed('foo/../../secrets')).toBe(false)
  })

  it('rejects non-overlay paths', () => {
    expect(isOverlayPathAllowed('package.json')).toBe(false)
    expect(isOverlayPathAllowed('app/page.tsx')).toBe(false)
    expect(isOverlayPathAllowed('locales')).toBe(false) // prefix alone, no file
  })
})
