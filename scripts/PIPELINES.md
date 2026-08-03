# PIPELINES — interactive chat message types

Smoke checklist for message interactive kit (poll / rsvp / dao_jar / share_card).
Run via `npm run smoke:pipelines` or `bash scripts/run-all-smokes.sh`.

| Row id | Intent | Status |
|---|---|---|
| `chat.poll.create_vote_close` | createPollMessage (+ closeAt) → castPollVote (locked) → closePoll / close-expired-polls cron → message:update | structural via `smoke-chat-interactive.cts` |
| `chat.rsvp.respond` | createRsvpMessage / createRsvpToContacts (meetup) → respondRsvp (locked) | structural via `smoke-chat-interactive.cts` |
| `chat.dao_jar.native_contribute_update` | postDaoJar + contributeToPool refreshes all open jars (`refreshOpenDaoJarMessages`) | structural via `smoke-chat-interactive.cts` |
| `chat.share_card.multi_dm` | shareToContacts fan-out N DMs; DAO list + FF Share / Post jar | structural via `smoke-chat-interactive.cts` |
| `chat.message.update_tunnel` | widget mutation publishes `message:update` | covered by MessageService.updateMessage / updateMessageLocked |
| `store.cart_summary.float_pay` | Product agent Cart Summary bar → Cart (/store/cart + product chat rail) / Pay & Buy (checkout); interactive kind `cart_summary` in registry | manual + structural (kind allowlist) |
| `chat.product_card.marker_hydrate` | `[product=$url_or_id]` in /messages or product-agent reply → CRM hydrate → `type: product_card` widget (View / Add to cart) | structural via `smoke-chat-interactive.cts` |
| `store.product_agent.cart_checkout_session_bound` | Anthropic tools `cart_add` / `cart_summary` / `checkout_redirect` → `store_user_carts` + soft-holds; strip model uid; navigateTo checkout (no createOrder); client hydrate | manual + unit on ProductCommerceToolRunner |
| `store.dagi.erp_chat_session_bound` | Vendor dashboard DAGI chat → `/api/vendor/dagi/chat` + `generateWithDagiTools`; bound `vendorEntityId` + `hasFeatureForVendor`; tools `dagi_*` (no ring-mcp Bearer) | manual unlock + ask stock/orders |
| `store.web_conductor.research_populate` | Research (create/edit + `dagi_research_product`) → WebConductor fields + `productAgent` + wiki NODUS + cabinet `store/product/alt` images + markdown; Use in gallery explicit | manual Research + DAGI tool |
| `cabinet.genmedia.sibling_save` | File cabinet detail Image/Video chat → generative-media fs-modal → save sibling under source `parentId` as `{base}-{enhanced\|enlive}-{ts}.{ext}` | manual desktop panel |

## Notes

- Native dao_jar contributions use `features/public-pools` treasury transfer — do **not** route through PaymentConductor.
- Card jar (`public_pool_contribution` PaymentPurpose) and Phase A builder payout remain **Emperor-gated** (TD-MONEY-*).
- Generative metadata kinds remain metadata-only on text/image (TD-PLAT-02).
- Reggie clone propagation still open (TD-PLAT-03) after this Tier A pass.
- Product agent Research uses **WebConductor** → TextConductor `webSearch` (same conductor path as news generate-article) plus citation-backed cabinet photos. Manual Research button only; TODOs for approve/cron enrichment.
- Guest PDP agent Q&A: limited tokens + productAgent-only; commerce tools login-only and must ignore model-supplied uid.
- DAGI: stake-time `vendorEntityId` bind + `hasFeatureForVendor`; tradeable secondary stake rebinds; ERP tools via `runDagiTool` (no chat-path ring-mcp Bearer). Vendor dashboard mounts `DagiErpChatPanel` when unlocked for the active store.
