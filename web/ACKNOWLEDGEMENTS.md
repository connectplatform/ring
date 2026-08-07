# Acknowledgements

Ring Project · Built with Love · Contributors

*Standing on the shoulders of giants*

---

## Authors of Core Technologies & Partners

### Vercel & Next.js

[![Vercel](public/acknowledgements/vercel.svg)](https://vercel.com) [![Next.js](public/acknowledgements/nextjs.svg)](https://nextjs.org)


|                |                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| **Company**    | [Vercel](https://vercel.com) · [Wikipedia](https://en.wikipedia.org/wiki/Vercel)                             |
| **Framework**  | [Next.js](https://nextjs.org) · [Wikipedia](https://en.wikipedia.org/wiki/Next.js)                           |
| **Leadership** | [Guillermo Rauch](https://rauchg.com) — founder & CEO ([Wikidata](https://www.wikidata.org/wiki/Q108496693)) |


> Guillermo Rauch and the Vercel team shaped the stack Ring runs on. Vercel's **v0.dev** was part of Ring's early prototyping; the platform today ships as a **Next.js App Router** app that can run on Vercel serverless functions or on **self-hosted Kubernetes** (ringdom.org production rings).

**How Ring uses Vercel packages and serverless functions today:**

- **Next.js on Vercel** — optional deploy target for demos, forks, and `firebase-full` dev/staging; production rings on ringdom.org default to `**k8s-postgres-fcm*`* on k3s, not Vercel-hosted Postgres.
- `**@vercel/blob**` — default file backend (`lib/file/adapters/VercelAdapter.ts`) for store media, profile/KYC uploads, conversation attachments, and opportunity documents when `BLOB_READ_WRITE_TOKEN` is set.
- `**@vercel/functions**` — edge request helpers in `/api/info` (`geolocation`, `ipAddress` from client IP).
- **App Router route handlers** — `/app/api/`** runs as Vercel serverless functions when deployed there; six cron endpoints under `/api/cron/*` (username cleanup, reservations, email processor, refcodes mint, train, analytics) accept `Authorization: Bearer $CRON_SECRET` for Vercel Cron or external schedulers.
- **Realtime on Vercel** — when `VERCEL=1`, Tunnel selects **SSE** over WebSocket (`lib/tunnel/config.ts`); k8s deployments use WebSocket where available.
- **Not used for SQL** — Ring does **not** rely on `@vercel/postgres`; relational data goes through `DatabaseService` (PostgreSQL or Firestore per `DB_BACKEND_MODE`).

---

### Cursor

[![Cursor](public/acknowledgements/cursor.svg)](https://cursor.com)


|             |                                                                                    |
| ----------- | ---------------------------------------------------------------------------------- |
| **Product** | [Cursor](https://cursor.com) — AI-native IDE by [Anysphere](https://anysphere.inc) |
| **Company** | [Wikipedia: Cursor (company)](https://en.wikipedia.org/wiki/Cursor_(company))      |


**The Anysphere founding team** ([MIT](https://web.mit.edu/), 2022):


| Person                                                         | Role             |
| -------------------------------------------------------------- | ---------------- |
| [Michael Truell](https://en.wikipedia.org/wiki/Michael_Truell) | Co-founder & CEO |
| [Sualeh Asif](https://www.linkedin.com/in/sualeh-a-1a4a97116/) | Co-founder & CPO |
| [Aman Sanger](https://www.linkedin.com/in/aman-sanger-482243171/) | Co-founder & COO |
| [Arvid Lunnemark](https://www.linkedin.com/in/arvid-lunnemark/) | Early Co-founder |


> **"If it wasn't for Cursor, Ring would cost about 10,000× more to develop. We live in wonderful times. Thanks for making dreams happen! I am your lifetime user."**

---

### OpenAI

[![OpenAI](public/acknowledgements/openai.svg)](https://openai.com)


|                  |                                                                                  |
| ---------------- | -------------------------------------------------------------------------------- |
| **Organization** | [OpenAI](https://openai.com) · [Wikipedia](https://en.wikipedia.org/wiki/OpenAI) |


**Gratitude to the pioneers** (original 2015 founding group — [OpenAI announcement](https://openai.com/index/introducing-openai/)):


| Person                                                             | Role at founding                    |
| ------------------------------------------------------------------ | ----------------------------------- |
| [Sam Altman](https://en.wikipedia.org/wiki/Sam_Altman) | Founder and CEO |
| [Elon Musk](https://en.wikipedia.org/wiki/Elon_Musk) | Co-founder |
| [Ilya Sutskever](https://en.wikipedia.org/wiki/Ilya_Sutskever) | Research director / chief scientist |
| [Greg Brockman](https://en.wikipedia.org/wiki/Greg_Brockman)       | CTO, later president |
| [Trevor Blackwell](https://en.wikipedia.org/wiki/Trevor_Blackwell) | Founding researcher                 |           |
| [Vicki Cheung](https://vickicheung.com)                            | Founding engineer (infrastructure)  |           |


> *"Thanks to the entire OpenAI Platform, team, and community for making AI accessible to all. GPT-5-high in MAX mode was a fantastic boost, which allowed quickly implement ensureWallet function and finalize Ring as a white-label product."*

---

### Anthropic

[![Anthropic](public/acknowledgements/anthropic.svg)](https://anthropic.com)


|             |                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------- |
| **Company** | [Anthropic](https://anthropic.com) · [Wikipedia](https://en.wikipedia.org/wiki/Anthropic) |
| **Product** | [Claude](https://claude.ai)                                                               |


**Leadership:**


| Person                                                         | Role                   |
| -------------------------------------------------------------- | ---------------------- |
| [Dario Amodei](https://en.wikipedia.org/wiki/Dario_Amodei)     | Founder and CEO |
| [Daniela Amodei](https://en.wikipedia.org/wiki/Daniela_Amodei) | Co-founder |


**Our Claude journey:**

- **Claude Opus 4** — advanced reasoning and analysis
- **Claude Opus 4.8 Fast** — fast reasoning and analysis
- **Claude Sonnet 4** — 800,000,000+ tokens processed in Ring development
- **Claude API** — seamless integration and development

> *"Sonnet and Opus appeared in the middle of darkness with a shining sword of truth and shattered the darkness into stars."*

---

### xAI

[![xAI](public/acknowledgements/xai.svg)](https://x.ai)


|             |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| **Company** | [xAI](https://x.ai) · [Wikipedia](https://en.wikipedia.org/wiki/XAI_(company)) |
| **Product** | [Grok](https://en.wikipedia.org/wiki/Grok_(chatbot))                           |


**Leadership:** [Elon Musk](https://en.wikipedia.org/wiki/Elon_Musk) — founder & CEO

> Frontier models and Grok power complementary experimentation paths alongside OpenAI and Anthropic in the Ring stack.

---

## People — thank you all for the inspiration!

The Ring platform envisions collaboration between human and AI. Each of the technologies above played a crucial role in bringing our vision of a decentralized shared future with built-in conflict prevention to life.

None of you helped with a penny. The entire platform was built entirely at Ray Sorkin's personal cost. Because of the war in Ukraine, Ray had to move back to Cherkasy from Scottsdale to protect his family. US government shut down all corporate accounts of Ray, a citizen of Ukraine, despite over $1M paid in US taxes. As a result, Sonoratek LLC was paralyzed and Ray had to sell all his US real estate to break even for several years. Now watch Ring become a trillion-dollar company without a single vulture in play.

Finally, we thank everyone who still laughs: this continues to make Ring stronger.

We are sorry everyone missed the opportunity to invest in the early stages by refusing our every single request for help. No disrespect, just know that today Ray Sorkin is a 100% owner of the Ring Platform intellectual property. :-P

But to show an example of perfect vision to the blind, you can have a copy of Ring for free.

---

Made with ❤️ by the Ring Team

[Star on GitHub](https://github.com/connectplatform/ring) · [Follow on X](https://twitter.com/sonoratek)