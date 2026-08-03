import { parseWikiLinkInner, parseWikiLinks, mapWikiLinksOutsideCode } from '@/features/wiki/wikilink-parser'
import { canCreateInVault, canWriteVault, type WikiActor } from '@/features/wiki/acl'
import { slugifyTitle, projectVaultKey } from '@/features/wiki/vault-key'
import { TENANT_SCHEMA_BODY } from '@/features/wiki/schema-seed'
import { markdownToEditorHtml } from '@/features/wiki/wiki-markdown-codec'
import {
  findPageByWikiTarget,
  wikiTargetSlugHint,
} from '@/features/wiki/resolve-page-target'
import {
  buildWikiTree,
  pagesToTreeFiles,
  rankWikiQuickSearch,
} from '@/features/wiki/wiki-page-tree'

describe('wiki wikilinks', () => {
  it('parses local and tenant refs', () => {
    const links = parseWikiLinks('See [[Payments]] and [[@Schema]] plus [[tenant:ACL|access]]')
    expect(links).toHaveLength(3)
    expect(links[0].linkKind).toBe('local')
    expect(links[1].linkKind).toBe('tenant_ref')
    expect(links[1].target).toBe('Schema')
    expect(links[2].display).toBe('access')
    expect(parseWikiLinkInner('@Foo').linkKind).toBe('tenant_ref')
  })

  it('ignores wikilinks inside inline code and fenced blocks', () => {
    const md = [
      'Live [[Payments]]',
      'Doc `[[slug]]` and `[[Title]]`',
      '```text',
      '[[path/slug]]',
      '[[@Payments]]',
      '```',
      'Also [[ACL]]',
    ].join('\n')
    const links = parseWikiLinks(md)
    expect(links.map((l) => l.target).sort()).toEqual(['ACL', 'Payments'])
  })

  it('mapWikiLinksOutsideCode leaves code examples untouched', () => {
    const md = 'See [[Live]] and `[[slug]]`\n```\n[[Nope]]\n```\n'
    const mapped = mapWikiLinksOutsideCode(md, () => 'LINK')
    expect(mapped).toContain('LINK')
    expect(mapped).toContain('`[[slug]]`')
    expect(mapped).toContain('[[Nope]]')
  })

  it('schema seed body creates no live wikilinks', () => {
    expect(parseWikiLinks(TENANT_SCHEMA_BODY)).toHaveLength(0)
  })

  it('editor html codec does not promote code-fence wikilinks', () => {
    const html = markdownToEditorHtml(
      'Live [[Payments]]\n\n```text\n[[slug]]\n```\n',
    )
    expect(html).toContain('data-wiki-target="Payments"')
    expect(html).toContain('[[slug]]')
    expect(html).not.toContain('data-wiki-target="slug"')
  })

  it('codec renders headings and GFM tables for TipTap', () => {
    const html = markdownToEditorHtml(
      [
        '# Title One',
        '## Title Two',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
      ].join('\n'),
    )
    expect(html).toContain('<h1>')
    expect(html).toContain('Title One')
    expect(html).toContain('<h2>')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>')
    expect(html).toContain('<td>')
  })
})

describe('wiki target resolve', () => {
  const pages = [
    {
      id: '1',
      title: 'Payments',
      slug: 'payments',
      path: 'concepts',
      bodyMarkdown: '',
      vaultKey: 'tenant' as const,
      kind: 'concept' as const,
      frontmatter: { aliases: ['pay'] },
      createdBy: 'a',
      updatedBy: 'a',
      createdAt: '',
      updatedAt: '',
    },
  ]

  it('prefers path/slug and slugifies leaf hints', () => {
    expect(wikiTargetSlugHint('concepts/My Page')).toBe('my-page')
    expect(findPageByWikiTarget(pages, 'concepts/payments')?.id).toBe('1')
    expect(findPageByWikiTarget(pages, 'Payments')?.id).toBe('1')
    expect(findPageByWikiTarget(pages, 'pay')?.id).toBe('1')
    expect(findPageByWikiTarget(pages, 'missing')).toBeNull()
  })
})

describe('wiki page tree', () => {
  it('builds folder hierarchy and ranks quick search', () => {
    const files = pagesToTreeFiles([
      {
        id: '1',
        title: 'Payments',
        slug: 'payments',
        path: 'concepts',
        bodyMarkdown: '',
        vaultKey: 'tenant',
        kind: 'concept',
        frontmatter: {},
        createdBy: 'a',
        updatedBy: 'a',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        title: 'Schema',
        slug: '_schema',
        path: '',
        bodyMarkdown: '',
        vaultKey: 'tenant',
        kind: 'schema',
        frontmatter: {},
        createdBy: 'a',
        updatedBy: 'a',
        createdAt: '',
        updatedAt: '',
      },
    ])
    const root = buildWikiTree(files)
    expect(root.children.concepts?.files[0]?.slug).toBe('payments')
    expect(root.files[0]?.slug).toBe('_schema')
    const ranked = rankWikiQuickSearch(files, 'pay')
    expect(ranked[0]?.file.slug).toBe('payments')
  })
})

describe('wiki vaultKey', () => {
  it('builds project vault keys', () => {
    expect(projectVaultKey('abc')).toBe('po:abc')
    expect(slugifyTitle('Hello World!')).toBe('hello-world')
    expect(slugifyTitle('path/slug')).toBe('path-slug')
  })
})

describe('wiki ACL', () => {
  const agent: WikiActor = { userId: 'agent', isAgent: true }
  const admin: WikiActor = { userId: 'admin', role: 'admin' }
  const buyer: WikiActor = {
    userId: 'buyer',
    isBuyer: true,
    isBuyerOf: (id) => id === 'o1',
  }
  const integrator: WikiActor = {
    userId: 'int',
    isIntegrator: true,
    isIntegratorOf: (id) => id === 'o1',
  }

  it('denies agent tenant writes', () => {
    expect(canWriteVault(agent, 'tenant').ok).toBe(false)
    expect(canCreateInVault(agent, 'tenant').ok).toBe(false)
  })

  it('allows agent project writes', () => {
    expect(canWriteVault(agent, 'po:o1').ok).toBe(true)
  })

  it('forces integrator tenant append-only', () => {
    expect(canWriteVault(integrator, 'tenant', 'replace').ok).toBe(false)
    expect(canWriteVault(integrator, 'tenant', 'append').ok).toBe(true)
    expect(canCreateInVault(integrator, 'tenant').ok).toBe(true)
  })

  it('allows buyer/admin full tenant write', () => {
    expect(canWriteVault(buyer, 'tenant', 'replace').ok).toBe(true)
    expect(canWriteVault(admin, 'tenant', 'replace').ok).toBe(true)
  })

  it('scopes project vault to buyer/integrator', () => {
    expect(canWriteVault(buyer, 'po:o1').ok).toBe(true)
    expect(canWriteVault(buyer, 'po:other').ok).toBe(false)
    expect(canWriteVault(integrator, 'po:o1').ok).toBe(true)
  })
})
