# Ring PR-Ops Conductor (Grok-native MCP)

Open-source extract of the Ringdom PR-Ops **conductor-gateway** and ClusterIP MCP bridges (Twenty, Outline, Mattermost, Temporal).

## Why this exists

Anthropic hosted `mcp_servers` cannot reach Kubernetes ClusterIP URLs. This gateway:

1. Discovers tools from in-cluster Streamable HTTP MCP servers
2. Prefers **xAI Grok** via the OpenAI-compatible **Responses API** function calling
3. Falls back to Anthropic Haiku on the same **local** tool loop
4. Returns `tool_trace` on `/boss` and `/route`

## Quick start (local)

```bash
cd conductor
npm install && npm run build
export XAI_API_KEY=...
export ENABLE_MCP_TOOLS=true
export TWENTY_MCP_URL=http://127.0.0.1:5008/mcp
export PLANE_MCP_URL=off
npm start
curl -s localhost:4000/health | jq .
```

## Images

`ghcr.io/connectplatform/ring/pr-ops/{conductor-gateway,twenty-mcp,outline-mcp,mattermost-mcp,temporal-mcp}:latest`

## Env

| Variable | Meaning |
|---|---|
| `XAI_API_KEY` | Prefer Grok when set |
| `XAI_MODEL` | Default `grok-3` |
| `ENABLE_MCP_TOOLS` | Local MCP catalog + tool loop |
| `ENABLE_ANTHROPIC_REMOTE_MCP` | Experimental cloud MCP (not for ClusterIP) |
| `PLANE_MCP_URL` | Set `off` until Plane MCP is deployed |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Haiku fallback |

## Security

Keep MCP Services ClusterIP-only. Do not expose MCP Ingress publicly.
