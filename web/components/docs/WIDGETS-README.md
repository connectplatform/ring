# Ring Platform — Docs & Site Widgets Reference

SSOT for **ring-widgets** (reusable React UI blocks) and **ring-docs-widgets** (the subset registered in `docsMdxComponents` for MDX authoring). Canonical machine catalog: `AI-CONTEXT/concepts/ring-docs.nodus.json` → `ring_widgets.by_id` (jq-queryable; see `creative_agent_bootstrap.keys_tree` in that file — prefer jq over loading this markdown into agent context).

**Taxonomy:** `ring-docs-widgets ⊆ ring-widgets` — every MDX component is a ring-widget; site-only widgets live under `components/ring-widgets/` and may or may not be exposed to docs.

## Registration pipeline

| Layer | Path | Role |
|-------|------|------|
| MDX component map | `components/docs/mdx-docs-shared.tsx` | Registers JSX tags available in every `docs/{locale}/**/*.mdx` page |
| Heavy client loader | `components/docs/mdx-heavy-components.tsx` | `dynamic(..., { ssr: false })` for browser-only widgets |
| Site widget barrel | `components/ring-widgets/index.ts` | App rails, marketing, wallet — import from `@/components/ring-widgets` |
| Content | `docs/{locale}/` | Authors use registered tags; no per-page imports |
| Resolver | `lib/docs/docs-path.ts` | Slug → file; `buildDocsHref()` for locale-aware links inside widgets |
| Layout + audience | `docs-layout-shell.tsx`, `docs-audience-context.tsx` | `DocsAudienceProvider` wraps docs pages |
| Sidebar | `docs-navigation-panel.tsx`, `docs-audience-selector.tsx`, `docs-sidebar-controls.tsx` | Search, Founder/Developer filter, theme/locale |

**Retired (do not author or link):** `docs/content/{locale}/library/`, URL segment `/docs/library/`.

**Typography SSOT:** `lib/docs/markdown-prose-classes.ts` — Tailwind class tokens for MDX element map + changelog GFM mods. Do **not** install `@tailwindcss/typography`.

**Changelog UI SSOT:** append-only `docs/{locale}/changelog.json` (`[{ date, version, mods[] }]`) rendered on `/changelog` as DaVinci-glass cards via `lib/docs/render-gfm-mod.tsx` (React GFM — no `dangerouslySetInnerHTML`). Route is **`force-static`** (build-time prerender per locale). Root `CHANGELOG.md` is **deprecated for UI** — points readers to https://ring-platform.org/changelog. No CRUD UI.

Client-only widgets show a pulse placeholder during SSR (`mdx-heavy-components.tsx`). Prefer **`locale="uk"`** / **`locale="ru"`** props on visual widgets when the MDX page is translated but copy is embedded in the component.

## Table of Contents

1. [Content & layout (MDX)](#content--layout-mdx)
2. [Code & math (MDX)](#code--math-mdx)
3. [Visualization — diagrams (MDX)](#visualization--diagrams-mdx)
4. [Visualization — Ring welcome & product story (MDX)](#visualization--ring-welcome--product-story-mdx)
5. [Visualization — onboarding & integrations (MDX)](#visualization--onboarding--integrations-mdx)
6. [Contact & explore (MDX + site)](#contact--explore-mdx--site)
7. [Site-only ring-widgets](#site-only-ring-widgets)
8. [App UI profile widgets (not MDX)](#app-ui-profile-widgets-not-mdx)
9. [Docs components not in MDX map](#docs-components-not-in-mdx-map)
10. [Embeddable custom element](#embeddable-custom-element)
11. [Authoring rules](#authoring-rules)
12. [Adding a new widget](#adding-a-new-widget)
13. [Related docs](#related-docs)
13. [RelatedArticle widget](#relatedarticle-widget)
14. [Adding a new widget](#adding-a-new-widget)

---

## Content & layout (MDX)

| Widget | File | SSR | Description |
|--------|------|-----|-------------|
| **Audience** | `audience-block.tsx` | No | Dual-audience gate — `for="founder"` \| `for="developer"` \| `for="both"`. Filtered by sidebar Founder/Developer tabs. |
| **Callout** | `callout.tsx` | Yes | Highlighted prose — types: `info`, `tip`, `success`, `warning`, `error`, `development`, `financing`. Optional `title`. |
| **Steps** | `steps.tsx` | Yes | Numbered vertical tutorial container. Each child must be `<Step>`. |
| **Step** | `steps.tsx` | Yes | Single step body inside `<Steps>`. |
| **Tabs** | `tabs.tsx` | Yes | Tabbed regions; pass `items={[...]}` or child `<Tab value="…">` panels. |
| **Tab** | `tabs.tsx` | Yes | One tab panel inside `<Tabs>`. |
| **Card** | `card.tsx` | Yes | Linked navigation card (`title`, `href`, description children). |
| **Cards** | `card.tsx` | Yes | Responsive grid wrapper for multiple `<Card>` children. |
| **UiCard** | `@/components/ui/card` | Yes | Shadcn card primitive for custom MDX layouts (distinct from docs `<Card>`). |
| **UiCardHeader** | `@/components/ui/card` | Yes | Shadcn card header slot. |
| **UiCardTitle** | `@/components/ui/card` | Yes | Shadcn card title slot. |
| **UiCardDescription** | `@/components/ui/card` | Yes | Shadcn card description slot. |
| **UiCardContent** | `@/components/ui/card` | Yes | Shadcn card content slot. |
| **FutureFeatureBacklog** | `future-feature-widget.tsx` | No | Section wrapper for TBD roadmap items stripped during doc truth passes. |
| **FutureFeatureWidget** | `future-feature-widget.tsx` | No | DaVinci-glass backlog card — live likes + native RING chip-in via `public_pools` API. Props: `name`, `description`, `implementationCost`, `labels[]`, optional `poolSlug`. |

```mdx
<FutureFeatureBacklog title="Backlog — example (TBD)">
<FutureFeatureWidget
  name="Feature name"
  description="What legacy doc claimed; not in OSS tree."
  implementationCost={40}
  labels={['ops', 'backup']}
  voteCount={0}
/>
</FutureFeatureBacklog>
```

```mdx
<Callout type="info">
  Use **Founder** / **Developer** tabs in the docs sidebar to filter this page.
</Callout>

<Audience for="founder">
<Cards>...</Cards>
</Audience>

<Audience for="developer">
<Steps>...</Steps>
</Audience>
```

---

## Code & math (MDX)

| Widget | File | SSR | Description |
|--------|------|-----|-------------|
| **Code** | `code.tsx` | Yes (async) | Shiki-highlighted block — `language`, optional `title`, `showLineNumbers`. Fenced ` ```lang ` rewritten by `rehype-code-fence-to-mdx`. |
| **Mermaid** | `mermaid.tsx` | No | Flowchart, sequence, mindmap, etc. — JSX or fenced ` ```mermaid `. Serialized render queue in `lib/mermaid-render.ts`. |
| **MindMap** | `mindmap.tsx` | No | Thin alias: wraps `<Mermaid type="mindmap">` with `mindmap` root normalization. |
| **Math** | `math.tsx` | No | Inline KaTeX. |
| **MathBlock** / display **Math** | `math.tsx` | No | Display KaTeX inside `DiagramViewer` (`compact`, fullscreen zoom + theme + **Copy** LaTeX). SVG copy skipped (KaTeX is HTML/MathML). |
| **DiagramViewer** | `diagram-viewer.tsx` | No | Fullscreen zoom/pan/theme chrome for Mermaid + display Math. Optional `copyText`. |
| **CodeSandbox** | `code-sandbox.tsx` | No | Sandpack live editor — `code`, `files`, `template`, `showPreview`, `title`. Outer `overflow-x-auto` under docs shell. |

**Mermaid mindmap rules:** one `root((…))` node; no `<br/>` inside root circles; indent children under category headers. See `AI-CONTEXT/concepts/ring-docs.nodus.json` → `Mermaid.render_contract`.

---

## Visualization — diagrams (MDX)

| Widget | File | SSR | Description |
|--------|------|-----|-------------|
| **RingMatcherOrchestration** | `ring-matcher-orchestration.tsx` | No | **Default docs hub matcher demo** — lightweight SVG loop (users → AI engine → match notifications). Props: `locale?`, `title?`, `subtitle?`, `autoPlay?`. Used on `/docs` index pages. |
| **RingAISynapseFlow** | `ring-ai-synapse-flow.tsx` | No | **Heavy legacy demo** — Three.js logo, quantum lasers, animated DMs. Props: `title?`, `subtitle?`, `autoPlay?`, `locale?`. Preserved; avoid on dense reference pages. |
| **RingGatewayBridge** | `ring-gateway-bridge.tsx` | No | **Emit → Match → Notify** three-step bridge with animated connectors. Props: `locale?` (`en` \| `uk` \| `ru`), `title?`, `subtitle?`. |
| **Timeline** | `timeline.tsx` | No | `react-chrono` vertical/alternating timeline — `items`, `mode?`. Theme follows `document.documentElement` dark class. |

```mdx
<RingMatcherOrchestration locale="uk" autoPlay={true} />

<RingGatewayBridge locale="en" />
```

---

## Visualization — Ring welcome & product story (MDX)

All in `ring-welcome-visuals.tsx` unless noted. Shared **`locale`** prop: `en` \| `uk` \| `ru`.

| Widget | Description | Typical usage |
|--------|-------------|---------------|
| **RingCollectiveIntelligenceLoop** | Horizontal flywheel — community use → AI learns → better matches → success → richer signals (animated loop on desktop). | `/docs/welcome`, product story pages |
| **RingFeatureEcosystem** | Five-pillar grid (intelligence, UX, business, finance/Web3, infrastructure) with bullet lists per pillar. | Welcome, integrations hub, features index |
| **RingProblemSolvingEvolution** | Four-era timeline — individual → organizational → collective (Ring) → grand challenges. | Welcome, vision sections |
| **RingHumanityVision** | Values / impact narrative grid (peace, abundance, open source themes). | Welcome closing sections |
| **RingDeploymentPaths** | `ring-deployment-paths.tsx` — **three tabbed obtain paths** with **copyable commands**: (1) OSS `install.sh` self-deploy, (2) LegioX.pro settlement chat preview, (3) Promptor service. Props: `locale?`, `defaultPath?` (tab index). Embeds `RingLegioxSettlementChatPreview` on LegioX tab. | `/docs/welcome`, `/docs/getting-started` |

```mdx
<RingDeploymentPaths locale="uk" defaultPath={0} />

<RingFeatureEcosystem locale="en" />
```

---

## Visualization — onboarding & integrations (MDX)

| Widget | File | SSR | Description |
|--------|------|-----|-------------|
| **RingIntegrationPlanesHub** | `ring-widgets/ring-integration-planes-hub.tsx` | No | Mobile-first **integration planes** orb — center Next.js·PostgreSQL hub, five clickable planes (identity, payments, comms, mail, external) linking to canonical docs. Props: `locale?`, `theme?` (`inherit` \| `light` \| `dark`), `title?`, `subtitle?`. Copy: `lib/ring-widgets/integration-planes.ts`. |
| **RingApiTree** | `ring-widgets/ring-api-tree.tsx` | No | Vertical **9:14** API family tree — scrollable selectable `/api/*` endpoints (upper) + selected endpoint summary/methods panel (lower). Data: `ring-api-tree-data.ts` (~244 routes). Props: `initialEndpointId?`, `title?`, `className?`. Founder-friendly; embed on `/docs/api`. |
| **RingWelcomeFeatureExplorer** | `ring-widgets/ring-welcome-feature-explorer.tsx` | No | Tabbed **feature explorer** — sections of doc-linked feature cards from `lib/ring-widgets/welcome-features.ts`. Props: `locale?`, `theme?`, `title?`, `subtitle?`. |

```mdx
<RingIntegrationPlanesHub locale="en" />

<RingApiTree initialEndpointId="store/checkout" />

<RingWelcomeFeatureExplorer locale="uk" theme="inherit" />
```

---

## Contact & explore (MDX + site)

| Widget | File | MDX | Description |
|--------|------|-----|-------------|
| **RingWidgetsContact** | `ring-widgets/ring-widgets-contact.tsx` | Yes | Founder/team **contact card** — avatar, social links (X, LinkedIn, Telegram, WhatsApp), Ring public profile, custom links. Props validated by `lib/ring-widgets/contact-schema.ts` (Zod). |

```mdx
<RingWidgetsContact
  firstName="Ray"
  lastName="Empire"
  nickname="Ray"
  photoAvatar="/images/team/ray.jpg"
  xUsername="connectplatform"
  projectUsername="ray"
  telegramUsername="ray"
/>
```

**Site usage (not MDX):** `/about`, `/about-publisher`, marketing rails — same component, props from page data or `ring-config`.

---

## Site-only ring-widgets

Registered in `components/ring-widgets/index.ts` but **not** in `docsMdxComponents` (app layout / rails only).

| Widget | File | Description |
|--------|------|-------------|
| **PublisherGetStartedFlow** | `publisher-get-started-flow.tsx` | About-publisher **right rail** — vertical `install.sh → ring-config → deploy` pipeline + Quick Start CTA to `/docs/getting-started`. Props: `locale` (`Locale`). |
| **RingWalletBalance** | `ring-wallet-balance.tsx` | DaVinci glass **RING credit balance** hero — `displayBalance`, `usdEquivalent?`, `onTopUp?`, `onRefresh?`, `compact?`. Used on `/wallet` and profile rails. |

Import example:

```tsx
import { PublisherGetStartedFlow, RingWalletBalance } from '@/components/ring-widgets'
```

---

## App UI profile widgets (not MDX)

Account `/profile` Professional tab surfaces. **Not** registered in `docsMdxComponents` or `components/ring-widgets/` — app composition under `components/profile/`. Documented here so ring-docs / theme agents share one human SSOT with the Davinci-droplist call-site list.

| Widget | File | Description |
|--------|------|-------------|
| **OrganizationEntitySelect** | `organization-entity-select.tsx` | **Davinci-droplist** over `GET /api/entities` — Organization field; persists via `updateProfile`. |
| **ProfileTagCloud** | `profile-tag-cloud.tsx` | Shared FsModal tag picker — selected chips **inside + outside** modal; `DavinciDroplistItem` rows + QuickSearchFilter. |
| **PositionTagCloud** | `position-tag-cloud.tsx` | Thin wrapper → `ProfileTagCloud` + `KNOWN_POSITION_TAGS`. |
| **SkillsTagCloud** | `skills-tag-cloud.tsx` | Thin wrapper → `ProfileTagCloud` + `KNOWN_SKILL_TAGS`. |
| **CurriculumVitaeWidget** | `curriculum-vitae-widget.tsx` | My CV — `WikiRichEditor` markdown in full-viewport `FsModal` + `profile:cv` upload; `users.data.curriculumVitae` JSONB. Mobile: zero body padding, Close bottom-left, **Save & Exit** bottom-right; drafts via `useLocalStorage` (`profile_cv_draft_{userId}`). |

### Davinci-droplist call sites (app UI)

Shared widget: `components/ui/davinci-droplist.tsx` (FsModal + QuickSearchFilter + thick ScrollBar). Theme recipe: `.cursor/agents/ring-theme-enhancer.md` §7.

| Call site | Notes |
|-----------|--------|
| `CountrySelect` | Migrated |
| `TimezoneSelect` | Migrated |
| `ProductRepSelect` / `VendorEntitySelect` | Migrated |
| **OrganizationEntitySelect** | Profile Organization |
| **ProfileTagCloud** | Position / Skills — multi-tag confirm (uses `DavinciDroplistItem`, not single-select close-on-tap) |

See also: [Profile account widgets](/docs/features/profile-account).

---

## Docs components not in MDX map

Available for composition inside other widgets or future MDX promotion.

| Widget | File | Notes |
|--------|------|-------|
| **RingGatewayFlow** | `ring-gateway-flow.tsx` | **Deprecated** — re-exports `RingGatewayBridge`. Use `<RingGatewayBridge />` in MDX. |
| **RingLegioxSettlementChat** | `ring-legiox-settlement-chat.tsx` | Animated LegioX settlement chat mockup (`RingLegioxSettlementChatPreview`). Embedded by `RingDeploymentPaths` LegioX tab; not a top-level MDX tag today. |

---

## Embeddable custom element

| Widget | File | Scope |
|--------|------|-------|
| **`<ring-widget>`** | `components/common/custom-elements/ring-widget.ts` | **External sites** — custom element that mounts a minimal entity/opportunity list via `/api/entities`. Attributes: `theme`, `locale`, `categories`, `max-items`, `api-key`. React 19 `createRoot` hydration. |

Not part of MDX or `docsMdxComponents`. Register the custom element in the host app shell when embedding on third-party pages.

---

## Authoring rules

1. **Dual-audience:** shared intro + `<Audience for="founder">` / `<Audience for="developer">` — sidebar tabs filter; use `<Tabs>` only for in-audience variants (WayForPay vs Stripe).
2. **Hub pages:** one architecture diagram (Mermaid or one Ring viz widget) + `<Cards>` linking every child in section `meta.json`.
3. **Tutorials:** `<Steps>` / `<Step>` + `<Code>` — never skip `<Step>` wrappers (invalid MDX).
4. **Locale:** pass `locale="uk"` \| `locale="ru"` on visual widgets when the surrounding page is translated.
5. **Performance:** prefer `RingMatcherOrchestration` over `RingAISynapseFlow` on index/hub pages; reserve Three.js synapse flow for hero moments only.
6. **Links:** use `/docs/...` paths in widget copy and `<Card href>` — `next-intl` adds locale prefix at runtime (`localePrefix: as-needed`).
7. **Secrets:** never embed production keys in MDX or widget demo commands.
8. **Truth:** `rg`-verify env vars, routes, and modules before documenting; strip fabricated KPIs.

---

## Adding a new widget

1. Implement under `components/docs/` (docs-first) or `components/ring-widgets/` (site-first).
2. If MDX-facing: add `dynamic()` export to `mdx-heavy-components.tsx` (client) or direct import in `mdx-docs-shared.tsx` (server-safe).
3. Register the tag in `docsMdxComponents` inside `mdx-docs-shared.tsx`.
4. Add locale copy in `lib/ring-widgets/` when the widget is locale-aware.
5. Append entry to `AI-CONTEXT/concepts/ring-docs.nodus.json` → `ring_widgets.by_id.<WidgetId>` and update `ring_widgets.index` lists (`mdx_tag_ids`, `sections`, `by_kind` as applicable).
6. Document usage in `docs/en/features/doc-system.mdx` or `docs/en/development/docs-components.mdx`.
7. Update this file (`WIDGETS-README.md`).

---

## RelatedArticle widget

**Preferred “Related documentation” block** for feature/API articles.

```mdx
<RelatedDocs>

<RelatedArticle
  slug="features/admin"
  relation="Next-step: open the Admin console nav SSOT after you understand Wiki vaults."
/>

<RelatedArticle
  slug="features/owner-project-lab"
  relation="Same-workflow: project vaults attach to buyer/integrator Order Lab desks."
/>

</RelatedDocs>
```

| Prop | Meaning |
|------|---------|
| `slug` | Library-relative path (no locale, no `/docs`, no `.mdx`) — e.g. `features/admin-wiki`. Widget resolves **Article Title** from EN frontmatter. |
| `relation` | One concrete reader-facing reason to continue (not a bare enum label). |
| `title?` | Optional override if frontmatter title is wrong. |

### Ring relation tree (authoring vocabulary)

Free-text `relation` is SSOT for the reader. When useful, embed these verbs naturally:

| Verb | Reader intent |
|------|----------------|
| **prerequisite** | Read this before the current article lands |
| **next-step** | Natural continuation of the same journey |
| **deep-dive** | More technical / API depth on the same topic |
| **same-workflow** | Same operator desk or clone workflow |
| **depends-on** | Technical module this feature relies on |
| **see-also** | Loosely related; optional context |

Do **not** use bare `relation="see-also"` — write a sentence the reader can act on.

`Cards` / `Card` remain valid for hub indexes and non-related navigation. Prefer `RelatedDocs` + `RelatedArticle` for end-of-article related blocks.

---

## Related docs

- [Doc System feature](/docs/features/doc-system) — author-facing gallery and pipeline
- [Documentation components](/docs/development/docs-components) — quick reference and examples
- [AI-CONTEXT ring-docs concept](/Users/insight/code/ringdom/AI-CONTEXT/concepts/ring-docs.nodus.json) — machine-readable catalog
- [Hooks reference](/hooks/HOOKS-README.md) — complementary SSOT for `hooks/` (providers, FCM, tunnel)

---

## Full MDX registry (quick index)

Alphabetical list of tags in `docsMdxComponents` (includes RelatedArticle / RelatedDocs):

`Audience` · `Callout` · `Card` · `Cards` · `Code` · `CodeSandbox` · `FutureFeatureBacklog` · `FutureFeatureWidget` · `Math` · `MathBlock` · `Mermaid` · `MindMap` · `RelatedArticle` · `RelatedDocs` · `RingAISynapseFlow` · `RingApiTree` · `RingCollectiveIntelligenceLoop` · `RingDeploymentPaths` · `RingFeatureEcosystem` · `RingGatewayBridge` · `RingHumanityVision` · `RingIntegrationPlanesHub` · `RingMatcherOrchestration` · `RingProblemSolvingEvolution` · `RingWidgetsContact` · `RingWelcomeFeatureExplorer` · `Step` · `Steps` · `Tab` · `Tabs` · `Timeline` · `UiCard` · `UiCardContent` · `UiCardDescription` · `UiCardHeader` · `UiCardTitle`


**Site barrel exports:** `RingWidgetsContact` · `PublisherGetStartedFlow` · `RingIntegrationPlanesHub` · `RingApiTree` · `RingWelcomeFeatureExplorer` · `RingWalletBalance`

