# Дорожня карта платформи Ring

## ПОТОЧНИЙ СТАН

**Останнє оновлення:** 21 липня 2026  
**Версія:** **1.97.6**  
**Канонічна EN-дорожня карта:** [ROADMAP.md](ROADMAP.md)  
**Changelog:** [ring-platform.org/changelog](https://ring-platform.org/changelog)

---

## ЗАВЕРШЕНІ КЛЮЧОВІ ФУНКЦІЇ

### v1.97.x (липень 2026)
- Changelog на locale JSON + DaVinci-glass UI
- **Ring Mailer** — власний SMTP (`lib/mailer.ts`); Resend прибрано
- Owner CRM lab (`/my-orders`, `/my-jobs`), адмін `/admin/crm/*`
- Generative media; mood player; публічний `/{username}/player`
- PayPal + розширення PaymentConductor; локалі **DE/ES**
- NFT market (медіа / art-generate); admin supermenu; rewards
- **File Cabinet** — `/profile/cabinet`, `/shared`, `/gallery`, `/{username}/img`

### v1.6.x (червень 2026)
- AI-чат у магазині + SSE; ring-db `*Doc`; сплощення docs
- PaymentConductor v1; News Kingdom; науковий редактор; locale SSOT
- OSS-межа: `install.sh`, без k8s/cli у публічному дереві

### Раніше (2025–2026)
- React 19 + Next.js 16; Tunnel; AI Matcher; мультивендорний store
- Гаманець / токен / стейкінг / NFT gates; messaging
- Email AI CRM; PIN; white-label клони на K8s

---

## У ПРОЦЕСІ

- Глибина File Cabinet (папки, share UX, shared FileTree)
- Паритет docs для UK/RU/ES/DE у довгих MDX
- Глибший пошук + Matcher по вертикалях
- Serialization Hardening Phase 2

---

## ЗАПЛАНОВАНО

- Ring Academy
- Повне DAO-управління (on-chain voting UX)
- Мобільний застосунок (React Native / Expo)
- Додаткові мови (FR, PT, SW, …)

**Вже не «TODO» (реалізовано):** фронтенд messaging, NFT-маркетплейс, NFT gates, локалі ES/DE, AI Matcher.

---

## ТЕХНОЛОГІЧНИЙ СТЕК

- **Frontend:** Next.js 16.2, React 19.2, TypeScript 6, Tailwind 4.3
- **Auth:** Auth.js v5 — Google, Apple, MetaMask, Ring Mailer (OTP / magic / password), PIN
- **DB:** PostgreSQL (+ Firebase / Connect адаптери), ring-db `*Doc`
- **Web3:** wagmi 3, viem, Solana + EVM, NFT gate/market, стейкінг
- **Payments:** PaymentConductor — WayForPay, Stripe, PayPal, credit
- **Realtime:** Tunnel (SSE / WebSocket) + FCM
- **i18n:** next-intl — en, uk, ru, es, de
- **AI:** Matcher + LLM; Legiox MCP (шар Ringdom / IDE)

---

## МАСШТАБИ (2026-07-21)

- ~300 API route handlers · ~165 сторінок App Router · 41 модуль `features/`
- Production-клони: ring-platform.org, ringdom.org, greenfood.live, vikka.ua, zemna.ai, ring.ck.ua та інші

---

## РОЗТАШУВАННЯ КОДУ

- Email CRM pipeline → `features/email-crm/pipeline/`
- Native token price oracle → `features/wallet/services/native-token-price-oracle.ts`
- Auth SMTP SSOT → `lib/mailer.ts`

---

## ВИСНОВОК

Ring Platform у production і фазі розширення verticals / MCP-оркестрації.  
Актуальний інвентар можливостей: [FEATURESET.md](FEATURESET.md).

**Статус:** Production Deployed — Expansion  
**Версія:** 1.97.6
