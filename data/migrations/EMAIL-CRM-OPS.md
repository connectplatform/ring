# Email AI-CRM — internal production ops (Ringdom)

**Audience:** LegioX operators deploying Ringdom clones with a live community inbox.  
**Public developer docs:** `docs/content/en/library/features/email-ai-crm.mdx` (`.env.local` + `mail.example.com` placeholders only).

**Canonical code:** `ring-platform.org` (main).  
**Primary production mailbox (Ringdom):** `info@ringdom.org` on **ring-ringdom-org** k8s.

> Never commit IMAP/SMTP passwords. Load from k8s Secret or `AI-SECRETS/` (gitignored). Rotate if a credential ever appeared in git history.

---

## 1. Secrets source of truth

| Field | Ringdom internal path |
|-------|----------------------|
| Secrets JSON | `AI-SECRETS/ring-ringdom-org/ring-ringdom-org-secrets.json` |
| Mailbox account | `email_accounts.info` → `email`, `password` |
| Mail host | `mail_server.hostname` → `mail.ringdom.org` |

Map into runtime env (k8s Secret or `.env.local` on the **clone**, not committed):

| Env var | Value source |
|---------|----------------|
| `IMAP_HOST` | `mail_server.hostname` |
| `IMAP_PORT` | `993` |
| `IMAP_TLS` | `true` |
| `IMAP_TLS_REJECT_UNAUTHORIZED` | `false` (self-signed / internal CA on mail.ringdom.org) |
| `IMAP_USER` | `email_accounts.info.email` |
| `IMAP_PASSWORD` | `email_accounts.info.password` |
| `SMTP_HOST` | same as IMAP host |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` (STARTTLS) |
| `SMTP_USER` | same as `IMAP_USER` |
| `SMTP_PASSWORD` | same as `IMAP_PASSWORD` |
| `ANTHROPIC_API_KEY` | platform AI secret (not in email_accounts block) |
| `CRON_SECRET` | long random; shared by all `/api/cron/*` callers |
| `WEBHOOK_EMAIL_SECRET` | optional; Postfix pipe / external relay |
| `SLACK_WEBHOOK_URL` | optional; security + urgent alerts |

Processing defaults (see `env.local.template` **EMAIL CRM** block):

- `EMAIL_AUTO_SEND_ENABLED=false` until SMTP smoke test passes (step 5).
- `EMAIL_PROCESSOR_AUTOSTART=false` in k8s — use cron **poll**, not IDLE.
- Omit `EMAIL_CRM_PERSISTENCE` for Postgres JSONB (production).

---

## 2. Database (ring-ringdom-org)

**Database name:** `ring_ringdom_org` (clone-specific; dev canonical is `ring_platform`).

Apply **after** base `data/schema.sql` and any clone-specific migrations already on that DB:

```bash
export DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/ring_ringdom_org

psql "$DATABASE_URL" -f data/migrations/009_email_crm_jsonb.sql
psql "$DATABASE_URL" -f data/migrations/010_email_crm_tasks_jsonb.sql

psql "$DATABASE_URL" -c "\dt email_*"
```

Expected tables: `email_contacts`, `email_threads`, `email_messages`, `email_drafts`, `email_tasks`, `email_api_usage`.

### Legacy `001_email_crm_schema.sql`

If an older clone applied `001_email_crm_schema.sql` and column-model tables contain **rows**, migrate into JSONB `data` documents before `009`. Migration `009` drops **empty** legacy column tables only.

---

## 3. k8s rollout (ring-ringdom-org)

1. **Propagate** email CRM code from `ring-platform.org` to `ring-ringdom-org` (Reggie propagate or release image).
2. **Inject Secret** with IMAP/SMTP, `ANTHROPIC_API_KEY`, `CRON_SECRET`, optional webhook/Slack keys.
3. **Apply migrations** on `ring_ringdom_org` (section 2).
4. **CronJob** — poll inbox every **3 minutes** (adjust 1–5 min as needed):

```yaml
# spec.schedule: "*/3 * * * *"
# container curl example:
curl -sS -X POST "https://ringdom.org/api/cron/email-processor" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"action":"poll"}'
```

5. Optional: nightly `GET /api/cron/email-analytics` with same Bearer token.

### Cron actions reference

| `action` | Use on ring-ringdom-org |
|----------|-------------------------|
| `poll` | **Primary** — fetch UNSEEN, process, disconnect |
| `status` | Debug processor + IMAP stats |
| `mark-overdue-tasks` | Scheduled task hygiene |
| `start` / `stop` | IDLE only; requires `EMAIL_PROCESSOR_AUTOSTART` / `EMAIL_PROCESSOR_ALLOW_HTTP_START` — avoid in standard k8s |

Route: `app/api/cron/email-processor/route.ts` — fail-closed without `Authorization: Bearer $CRON_SECRET`.

---

## 4. SMTP smoke test (before auto-send)

1. Send email to `info@ringdom.org` from an external mailbox.
2. Trigger cron `poll` (or wait for CronJob).
3. **Admin UI** on ring-ringdom-org: `/en/admin/email-inbox` — thread appears.
4. `/en/admin/email-drafts` — approve draft → **Send**.
5. Confirm reply in sender inbox + outbound row in `email_messages`.

Then set `EMAIL_AUTO_SEND_ENABLED=true` in the clone Secret and roll the deployment.

---

## 5. Admin surface (verify after deploy)

| UI | Path |
|----|------|
| Inbox | `/{locale}/admin/email-inbox` |
| Thread | `/{locale}/admin/email-inbox/[id]` |
| Drafts | `/{locale}/admin/email-drafts` |
| Contacts | `/{locale}/admin/email-contacts` |
| Analytics | `/{locale}/admin/email-analytics` |
| Tasks | `/{locale}/admin/email-tasks` |

API prefix: `/api/admin/email/*` — session + `isPlatformAdmin`.

---

## 6. Ingest alternatives

| Mode | When |
|------|------|
| **IMAP cron poll** | Default for ring-ringdom-org + mail.ringdom.org |
| **Webhook** | `POST /api/webhooks/email/inbound` — Postfix pipe; auth via `WEBHOOK_EMAIL_SECRET` or HMAC `X-Email-Webhook-Signature` |
| **IDLE autostart** | Long-lived Node pod only; `instrumentation.ts` + `EMAIL_PROCESSOR_AUTOSTART=true` |

Processor entrypoints: `services/email/email-processor.ts` — `pollInboundBatch()`, `ingestEvent()`.

---

## 7. Troubleshooting (production)

| Symptom | Check |
|---------|--------|
| Empty inbox | Migrations on **clone** DB? Cron 200 + `processed > 0`? `IMAP_*` creds from Secret? |
| 401 on cron | `CRON_SECRET` in CronJob matches app env |
| Draft send fails | SMTP 587 STARTTLS to `mail.ringdom.org`; firewall from k8s egress |
| Duplicate AI spend | Should not happen — `email_messages` Message-ID dedup in processor |
| Auto-send never fires | `EMAIL_AUTO_SEND_ENABLED`; confidence rules in draft service |
| High Anthropic cost | Review `email_api_usage`; security blocks in logs |

---

## 8. Related paths

| Asset | Path |
|-------|------|
| Migrations | `009_email_crm_jsonb.sql`, `010_email_crm_tasks_jsonb.sql` |
| Migration index | `data/migrations/README.md` |
| Feature code | `features/email-crm/`, `services/email/` |
| Cron route | `app/api/cron/email-processor/route.ts` |
| Webhook | `app/api/webhooks/email/inbound/route.ts` |
| Env template | `env.local.template` (EMAIL CRM block) |
| Public docs | `docs/content/en/library/features/email-ai-crm.mdx` |
| AI-CONTEXT | `AI-CONTEXT/ring-platform.org/implementations/email-crm-production-2026-06-10.json` |

---

## 9. Other clones

Any white-label Ring clone with a community inbox follows the same pattern:

1. Apply `009` + `010` on **that clone's** `DATABASE_URL`.
2. Set IMAP/SMTP for the clone's mailbox (not necessarily info@ringdom.org).
3. Cron poll on the clone's public `BASE_URL`.

Ringdom-specific hostnames and secrets JSON paths in sections 1–3 apply to **ring-ringdom-org** only.
