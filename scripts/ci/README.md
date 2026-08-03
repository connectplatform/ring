# Layer1 CI (ringdom builder factory)

**Git:** `forge.ringdom.org/ringdom/ring` (= this tree until `ring/` + `ring-platform-org` split)  
**OCI:** `registry.ringdom.org/ringdom-clones/ring:v*-ring-platform-org-amd64`  
**Build:** k3s-3 BuildKit · **Prod:** k3s-or `ring-platform-org`

| Command | What |
|---------|------|
| `npm run push:layer1` | `git push origin` then build→publish→prod |
| `npm run ci:layer1` | Build→publish→prod (no git push) |
| `npm run ci:layer1:dry` | Dry-run |
| `ring prod --forge-buildkit` | Same as `ci:layer1` via CLI |
| `git push-layer1` | After `npm run ci:layer1:install-alias` |

Log: `ssh k3s-3 'tail -f /var/tmp/ring-forge-buildctl.log'`

Forgejo Actions (`.forgejo/workflows/layer1-ci.yml`) is staged for when `[actions]` + act_runner land on k3s-3. Until then, Emperor-machine CI above is SSOT.
