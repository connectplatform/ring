# Legacy path `ring-platform.old`

Kingdom path **`ring-platform.old`** is a **symlink → `ring/web`** (Final-Split cutover).

| Path | Role |
|------|------|
| `ring/` | Layer1 git root (`cli/`, `scripts/`, `web/`) |
| `ring/web/` | Next.js community SSOT |
| `ring-platform.old` | Deprecated alias → `ring/web` (do not create new tooling against this name) |
| `ring-platform-org/web/` | Empire web overlay (`.env.local`, Order Lab, org `ring-config`) |

**Removed:** kingdom path `ring-platform.org` as a checkout/symlink name (product hostname `ring-platform.org` and AI-CONTEXT project id are unrelated).

Remove `ring-platform.old` after CLI, secrets, agents, and muscle memory use only `ring/web` + `ring-platform-org`.
