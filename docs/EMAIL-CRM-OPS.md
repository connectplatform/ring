# Email CRM Ops — Multi-mailbox channels

## AUTH vs CRM split

| Concern | Config | Mailbox example |
|---------|--------|-----------------|
| Auth (OTP / magic / reset) | `SMTP_*` → `lib/mailer.ts` | `noreply@ring-platform.org` on auth host |
| CRM inbound + replies | `ring-config.emailCrm.channels[]` + `CRM_CHANNEL_<ID>_PASSWORD` | e.g. `info@ringdom.org` on `mail.ringdom.org` |

Do **not** point platform AUTH SMTP at the CRM inbox host unless intentionally shared.

## Channels SSOT

`ring-config.json` → `emailCrm`:

```json
{
  "enabled": true,
  "channels": [
    {
      "id": "support",
      "name": "Support",
      "enabled": true,
      "flow": "standard",
      "imap": { "host": "mail.example.com", "port": 993, "user": "support@example.com", "mailbox": "INBOX", "tls": true },
      "smtp": { "host": "mail.example.com", "port": 587, "user": "support@example.com", "from": "Support <support@example.com>" },
      "secretEnvPrefix": "CRM_CHANNEL_SUPPORT"
    }
  ]
}
```

### Flows

- `standard` — security + AI + tasks + draft/reply (current full pipeline)
- `ingest_only` — persist + `sourceChannel` label; skip tasks/drafts
- `tasks_only` — persist + auto-tasks; skip reply generation

Inbound messages/threads store `sourceChannel`, `channelId`, `channelName`.

Admin filter: `GET /api/admin/email/threads?sourceChannel=Support`

## Cron

- Poll: `POST /api/cron/email-processor` (Bearer `CRON_SECRET`) — polls **all** enabled channels
- Token cleanup: `GET /api/cron/cleanup-email-tokens` — expired `email_login_tokens`

### K8s CronJobs (`kctl k3s-or -n ring-platform-org`)

| CronJob | Schedule | Manifest |
|---------|----------|----------|
| `email-processor` | `*/5 * * * *` | `k8s/cronjob-email-processor.yaml` |
| `cleanup-email-tokens` | `15 3 * * *` (daily 03:15 UTC) | `k8s/cronjob-cleanup-email-tokens.yaml` |

```bash
# Apply (after CRON_SECRET is in ring-platform-org-secrets + Deployment env)
kctl k3s-or -n ring-platform-org apply -f k8s/cronjob-email-processor.yaml
kctl k3s-or -n ring-platform-org apply -f k8s/cronjob-cleanup-email-tokens.yaml

# Manual smoke
CRON_SECRET=$(kctl k3s-or -n ring-platform-org get secret ring-platform-org-secrets \
  -o jsonpath='{.data.CRON_SECRET}' | base64 -d)
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' \
  -d '{"action":"poll"}' https://ring-platform.org/api/cron/email-processor
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://ring-platform.org/api/cron/cleanup-email-tokens
```

## Migration

Apply `data/migrations/039_email_crm_channel_index.sql` for `sourceChannel` / `channelId` indexes.


## Jsonb require fix (2026-07)

`email-processor` crashed with `TypeError: e is not a constructor` when factories used CJS `require()` of Jsonb* repositories while repos imported the service modules (circular ESM/CJS interop).

**Fix:** types live in `features/email-crm/types/{contact,task,draft}.ts`; services use static ESM `import { Jsonb*Repository }`; repos use `import type` only.

**Auth vs CRM SMTP:** AUTH OTP/magic uses `lib/mailer.ts` + `SMTP_*`. CRM replies use per-channel SMTP from `loadCrmChannels()` / `CRM_CHANNEL_*_PASSWORD` via `EmailSenderService` (not AUTH transport).

**Cleanup cron:** `GET /api/cron/cleanup-email-tokens` is fail-closed (requires `CRON_SECRET`).
