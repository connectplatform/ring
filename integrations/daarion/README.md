# Daarion Integration Scaffold

This directory will host the imported legacy \ platform (Web3 wallet, staking, NFT market, store) as modular Ring domains.

## Planned domains
- wallet (features + services + API)
- staking (services + API)
- nft-market (features + services + API)
- store (features + services + API)

## Steps
1. Scan legacy source, map modules.
2. Split by domains and identify shared utilities.
3. Transpond to Ring abstractions (Auth.js v5, Firestore, WebSocket, i18n).
4. Add AI context files per domain and update \.
5. Implement adapters for blockchain and storage.
6. Write tests and migration docs.
