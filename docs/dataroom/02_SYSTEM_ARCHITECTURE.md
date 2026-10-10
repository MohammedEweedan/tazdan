# 02 — System architecture

See [../ARCHITECTURE.md](../ARCHITECTURE.md) (diagrams, layout, request path, workers) and [../SYSTEM_CONTEXT.md](../SYSTEM_CONTEXT.md) (actors and external systems).

Key properties for diligence:

- Single API service (Node 24/Express/TypeScript) with in-process workers; PostgreSQL system of record; Redis for limits and session revocation.
- Monolith with clear service boundaries (`services/ledger`, `remittance`, `treasury`, `reconciliation`, `risk`, `compliance`, `providers`, `business`, `platform`, `ai`).
- Money invariants enforced twice: in application code and by database triggers.
- External dependencies isolated behind adapters with declared modes.
- Hosting: one DigitalOcean droplet (API) + Vercel (website/cockpit) + app stores.
