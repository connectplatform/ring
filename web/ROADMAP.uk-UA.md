# Дорожня карта платформи Ring

## ПОТОЧНИЙ СТАН

**Останнє оновлення:** 3 серпня 2026  
**Версія:** **1.97.13** (changelog блоки **1.97.6 → 1.97.13**)  
**Канонічна EN:** [ROADMAP.md](ROADMAP.md)  
**Changelog:** [ring-platform.org/changelog](https://ring-platform.org/changelog)  
**Публічний UI:** [ring-platform.org/roadmap](https://ring-platform.org/roadmap)

Джерела: `.cursor/plans/completed/**`, модулі `features/` + `lib/*/conductor/`, відкриті `.cursor/plans/*.plan.md`.

---

## ЗАВЕРШЕНО (кластери)

### Стек Conductor
PaymentConductor · SubscriptionConductor · WalletConductor · ProcessConductor · ImageConductor · TextConductor · AudioConductor · VideoConductor · MediaConductor · NewsConductor  

У т.ч. внески в **public pools / DAO jars**, native-token rail, PayPal/Stripe/WFP/credit.

### Generative / медіа
Generative media + білінг кредитів · Autonomous Newsroom · Mood player · File Cabinet (основа)

### Комерція / Web3
Мультивендорний store · NFT gates + Exhibition market · Token desk / oracle · Wallet Connect auth · Settlement / refcodes

### DAO / колективи
`/dao` + public pools · `dao_jar` у чаті · opportunity `collective_need` · ERP/agro пресети з DAO-прапорцями

### CRM / пошта / lab
Ring Mailer · Email AI CRM pipeline · `/my-orders` / `/my-jobs` · admin CRM · calculator project orders · supermenu · rewards

### Collaboration
**Ring Tasks (готово)** — `task` у чаті, `/tasks` + `/tasks/[chatId]`, віджет, escrow, CRM escrow admin (`features/tasks/`)

### Платформа
Next.js 16.2 · React 19.2 · TS 6 · Tailwind 4.3 · wagmi 3 · локалі en/uk/ru/es/de · Tunnel · Messenger · Wiki

---

## У ПРОЦЕСІ

| Пріоритет | Тема |
|-----------|------|
| P0 | Глибина File Cabinet; Generative Gallery SSOT; DaVinci feed; PublicPool on-chain deploy |
| P1 | Messages rail; WebRTC Call UI; media derivatives; wallet desk; My-Orders credentials |
| P2 | Serialization Phase 2; docs locale parity; matcher auto-approve; ERP/affiliate ops |

---

## ЗАПЛАНОВАНО

### Найближчий горизонт (Q3 2026)
1. Інтерактивні типи чату (poll / rsvp / dao_jar / share_card)
2. Native token checkout hardening
3. Wagmi treasury swap (ERC-20 → RING)
4. Feed cursor SSOT
5. Feature shell + CalculatorEngine
6. Mobile menus (Admin vs Ring)
7. Telegram Login (Auth.js)
8. Push (VAPID + FCM split)
9. Contacts P5–P6 (picker + signed transfer)
10. **ERP admin hub** — vendor-store, zero-warehouse, stock (`ERPStockService` / inventory-sync / settlements)

### Середина (Q4 2026)
11. Reward System completion  
12. Per-product referral commission  
13. Admin Wiki depth  
14. Knowledge Base (pgvector)  
15. Tunnel remediation + native WSS  
16. Postgres NOTIFY → Tunnel  
17. RBAC hardening  
18. API compliance remediation  
19. Solana NFT Gate MVP-A production  

### Горизонт (2027+)
21. RING multi-chain (Aptos Move FA)  
22. Повне DAO governance UX  
23. Collective purchase protocols v2  
24. Intent-driven ring assembly (Reggie/MCP)  
25. Mobile shell (RN/Expo)  
26. Локалі FR/PT/SW  
27. Ring Academy  
28. Connect.Software marketplace  
29. PR-Ops / News-Ops PaaS  
30. Unified Ringdom knowledge layer  

### Вигадані модулі-прогалини
**MatchConductor** · **TunnelConductor** · **SettlementConductor** · **CloneConductor** · **AccessibilityConductor** · **ObservabilityConductor**

---

## СТЕК І МАСШТАБ

- ~300 API · ~165 сторінок · 41 `features/` · 10+ conductors  
- Деталі та посилання на плани — у [ROADMAP.md](ROADMAP.md)
