# Ring Mailer — ops (own SMTP auth + CRM outbound SSOT)

**Canonical code:** `ring-platform.org`  
**Transport SSOT:** `lib/mailer.ts` (Nodemailer pool)  
**CRM replies:** `features/email-crm/pipeline/smtp/email-sender.ts` → **per-channel SMTP** from `loadCrmChannels()` (not AUTH `lib/mailer.ts`)  
**Auth flows:** OTP + magic link (`/verify#token=…`) + forgot/reset  
**Truth lens:** `AI-LEGIOX/legiox-truth-lens/react-email-login-specialist.nodus.json`

> Never commit SMTP passwords. Load from k8s Secret or `AI-SECRETS/` (gitignored).

---

## 1. Replace Resend

| Old | New |
|-----|-----|
| `AUTH_RESEND_KEY` / Auth.js Resend provider | Ring Mailer + Credentials `email-otp` / `email-magic` |
| Magic link via Resend SaaS | Own SMTP (`mail.subiworx.com` for ring-platform.org MX; `mail.ringdom.org` for Ringdom CRM) |
| `signIn('resend')` | `requestLoginCode` → `signIn('email-otp')` or magic link → `/verify` |

**ring-platform.org prod (k3s-or):** auth SMTP = `noreply@ring-platform.org` @ `mail.subiworx.com` (subiworx mailserver). Do not confuse with k3s-3 `mail.ringdom.org`.

---

## 2. Env (auth sender)

| Env | Notes |
|-----|--------|
| `SMTP_HOST` | Prod AUTH: `mail.subiworx.com` (not CRM `mail.ringdom.org`) |
| `SMTP_PORT` | `587` STARTTLS (`SMTP_SECURE=false`) or `465` |
| `SMTP_USER` / `SMTP_PASSWORD` | Prefer `noreply@…` for auth (not CRM `info@`) |
| `SMTP_FROM` | `Ring Platform <noreply@ring-platform.org>` |
| `OTP_HMAC_SECRET` | ≥32-byte secret; falls back to `AUTH_SECRET` |
| `EMAIL_MODE=ethereal` | Local/dev without real SMTP |

Migration: `data/migrations/038_email_login_tokens.sql`

```bash
psql "$DATABASE_URL" -f data/migrations/038_email_login_tokens.sql
```

---

## 3. Link format (anti-scanner)

Magic links use **hash fragments** so bots do not auto-GET:

`https://ring-platform.org/verify#token=<opaque>`

`/verify` never consumes on GET — user clicks **Complete sign-in** → `signIn('email-magic')`.

Password reset: `/reset-password#token=…`

---

## 4. Mailbox separation

| Mailbox | Purpose |
|---------|---------|
| `noreply@` / `auth@` | Auth OTP, magic link, reset |
| `info@ringdom.org` | Email AI-CRM inbox (see EMAIL-CRM-OPS.md) |

Do not poll the auth mailbox with the CRM processor.

---

## 5. RingdomX (calculator `mail` add-on)

| `MAIL_MODE` | Behavior |
|-------------|----------|
| `ringdom` | Clone MX/SPF/DKIM → Ringdom docker-mailserver; credentials from satellite `AI-SECRETS/…-mail-secrets.json` |
| `byo` | Buyer sets `SMTP_*` / `IMAP_*` in Owner Secrets (`owner_private`) |

Pricing SSOT: `features/calculator/presets/project.ts` external id `mail`.

---

## 6. Smoke checklist

1. `EMAIL_MODE=ethereal` → request OTP → Ethereal preview URL in logs → verify code → session.
2. Prod SMTP → `nodemailer` send to self → check SPF/DKIM.
3. CRM draft approve → reply uses same transporter.
4. Confirm `AUTH_RESEND_KEY` is absent from templates and k8s Secret (deprecated — removed).
