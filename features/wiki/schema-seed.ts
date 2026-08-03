/** Default tenant `_schema` page — agent constitution for Admin Wiki. */

export const TENANT_SCHEMA_SLUG = '_schema'

export const TENANT_SCHEMA_TITLE = 'Wiki Schema'

/**
 * Marker from the first schema seed that embedded live [[example]] wikilinks
 * inside backticks (parser still matched them). Used to one-shot upgrade body.
 */
export const LEGACY_SCHEMA_LINK_EXAMPLES_MARKER = 'Same vault: `[[slug]]`'

/** Bump when link-parser / schema seed semantics require a one-shot graph resync */
export const SCHEMA_LINKS_VERSION = 2

export const TENANT_SCHEMA_BODY = `# Wiki Schema

Operational constitution for the Ring Admin Wiki (Karpathy / Obsidian pattern).

## Layers

1. **Sources** — \`kind: source\` summary pages (cite origins; do not store secrets).
2. **Wiki pages** — concepts, entities, synthesis (Markdown + wikilinks).
3. **This schema** — conventions agents and humans follow.

## Vaults

- \`tenant\` — platform knowledge.
- \`po:{orderId}\` — per project-order knowledge for buyer + integrator + agents.

## Wikilinks

Use double-bracket links in page bodies. Examples below are documentation only
(inside a fenced code block — they do **not** create graph edges):

\`\`\`text
[[My Concept]]
[[folder/my-page]]
[[Page Title|display label]]
[[@Payments]]
[[tenant:Payments]]
\`\`\`

- Same vault: title, slug, or path/slug; optional \`|display\`.
- Project → tenant: \`@Title\` or \`tenant:Title\` prefix inside the brackets.

## ACL (enforced by WikiService)

| Actor | Tenant | Project vault |
|-------|--------|---------------|
| Admin | R/W | R/W |
| Buyer | R/W | R/W (own orders) |
| Integrator | R + append-only | R/W (assigned) |
| Agent (ring-mcp) | R only | R/W |

## Agent ops

1. **Ingest** — create/update source + touch related pages; append \`wiki_events\`.
2. **Query** — \`ring-wiki-search\` then read pages; cite links.
3. **Lint** — \`ring-wiki-lint\` for orphans and dead links; create stubs for real missing pages.

## Forbidden

- Never store Order Lab env secrets or private keys in wiki bodies.
- Link to Order Lab \`#secrets\` / project-config instead.

## Catalog

Page catalog is **derived** (list/search API). Ops history is \`wiki_events\` (not a Markdown log page).
`
