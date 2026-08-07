# Ring (Layer1 SSOT)

Community Ring Platform — git root for:

- **Forge:** `https://forge.ringdom.org/ringdom/ring.git`
- **GitHub:** `https://github.com/connectplatform/ring`

## Layout

| Path | Role |
|------|------|
| [`web/`](web/) | Next.js 16 community app (Layer1 web SSOT) |
| [`cli/`](cli/) | Ring CLI (empire/local; not required for OSS `install.sh`) |
| [`scripts/`](scripts/) | Layer1 tooling, smokes, org-leak gate; `run-org-ci.sh` bridges to empire compose |
| `desktop/` | Future Tauri 2 client (Layer1 Apps plan) |
| `mobile/` | Future Capacitor 6 client (Layer1 Apps plan) |

**Org overlay (empire, not this repo):** sibling `../ring-platform-org/`

| Org path | Role |
|----------|------|
| `ring-platform-org/web/` | Layer2/3 **web overlay** (Order Lab, org `ring-config`, Layer3 registry, `.env.local`) |
| `ring-platform-org/k8s/`, `.forgejo/`, `scripts/ci/` | Ops (compose/deploy) — not merged into the Next image context; invoke via `npm run ci:layer1` |

Prod compose: merge **`ring-platform-org/web/`** onto **`ring/web/`** → BuildKit → OCI.

**Legacy path:** kingdom symlink `ring-platform.old` → `ring/web`. Prefer `ring/web`.

## ring-config SSOT

| File | Lives in | Role |
|------|----------|------|
| `web/ring-config.json` | **Layer1 (commit)** | Community defaults: `domains`/`baseUrl` → `http://localhost:3000`, `calculator.enabled: false`, firebase disabled. |
| `web/ring-config.template.json` | **Layer1 (commit)** | Blank clone starter + `$schema` (imported by `lib/ring-config-core.ts` as merge defaults). |
| `../ring-platform-org/web/ring-config.json` | **Empire overlay** | Portal/empire brand + `calculator.enabled: true` + endemic flags. Wins at **compose merge** only. |

**Never** DX-symlink org config into Layer1 — `check:org-leak` fails if `ring-config.json` is a symlink. Empire brand: `npm run merge:org-dev` / `npm run dev -- ring-platform-org`.

## Develop (community) — from `ring/`

```bash
cd /path/to/ring          # Layer1 root (GitHub: connectplatform/ring)
cp web/env.local.template web/.env.local
npm install --prefix web
npm run ensure:config     # no-op when committed ring-config.json present
npm run check:org-leak
npm run dev               # → web/
npm run build             # → web/
```

Or classic: `cd web && npm run dev`.

## Develop (empire) — kingdom layout only

```bash
# Preferred: compose merge (does not mutate Layer1 ring-config.json)
npm run merge:org-dev                   # → ../ring-platform-org/.dev-merge
npm run dev -- ring-platform-org         # merge + npm run in .dev-merge
npm run build -- ring-platform-org

# Optional in-tree DX (Order Lab / calculator / .env.local links — NOT config)
npm run setup:org-dx
npm run teardown:org-dx                 # restore community stubs / unlink DX

# other kingdom clones (sibling dirs):
npm run dev -- ring-n9life-com
```

**npm note:** pass the project name **after `--`**. Bare `npm run build ring-platform-org` is wrong (npm looks for a script named `ring-platform-org`).

Secrets: `../ring-platform-org/web/.env.local` (linked via `setup:org-dx` or present in merge). Community template: `web/env.local.template`.

**GitHub purity:** `.forgejo/`, `k8s/`, `.env.local` may be DX links — never commit them. **Do** commit `web/ring-config.json`. No `.reggie-propagate-exclude.json` in Layer1 (that file belongs on white-label / org destinations).

## Prod (empire)

See `.cursor/md-skills/layer1-prod-update.md`. Build context is merged **`ring/web` + `ring-platform-org/web`** (Layer1 config included, overlay wins).
