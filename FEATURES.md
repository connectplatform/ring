# Ring Platform features

Canonical feature inventory: **[FEATURESET.md](./FEATURESET.md)**.

## Ring Mailer (2026-07)

- Own SMTP auth (OTP, magic link, password reset) via `lib/mailer.ts` — **no Resend / `AUTH_RESEND_KEY`**
- Docs: [Ring Mailer & RingdomX Mail](./docs/en/features/ring-mailer.mdx)
- Founders: calculator external `mail` → **RingdomX Mail** (hosted MX or BYO SMTP)
- Developers: set `EMAIL_MODE=ethereal` or `SMTP_*`; apply migration `038_email_login_tokens.sql`

See also [CHANGELOG.md](./CHANGELOG.md) `[1.97.4]` and [README.md](./README.md) authentication section.
