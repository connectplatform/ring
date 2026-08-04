# Changelog

Release notes for **Ring Platform** are published on the site:

**https://ring-platform.org/changelog**

(Localized: `/uk/changelog`, `/ru/changelog`, `/de/changelog`, `/es/changelog`.)

## Source of truth (UI)

Append-only JSON — not this Markdown file:

- `docs/{locale}/changelog.json` — `{ date, version, mods[] }`
- Page: `/changelog` (build-time static HTML)

## Related standing docs

| Doc | Role |
|-----|------|
| [ROADMAP.md](ROADMAP.md) | Engineering roadmap — shipped conductors/DAO/pools + prioritized backlog |
| [ROADMAP.uk-UA.md](ROADMAP.uk-UA.md) | Ukrainian summary |
| `locales/*/roadmap.json` | Public `/roadmap` page copy (all locales) |
| [FEATURESET.md](FEATURESET.md) | Capability inventory |

**History origin:** 2024 (Ring Platform 0.1 genesis; 99+ feature releases).

**Latest docs note (1.97.17):** Share & Earn username `#tag` + credit payouts; profile personal-page / Page Builder UX. Changelog UI tops at **1.97.17**. README/FEATURESET aligned to package `1.97.17`.

This root `CHANGELOG.md` is **deprecated for the product UI**. Prefer [ring-platform.org/changelog](https://ring-platform.org/changelog) and edit the locale JSON files when shipping notes.
