# 18 — Scalability

**No load or performance testing was performed in this programme.** The statements below describe the design, not measured capacity.

| Aspect | Design | Limit / next step |
|---|---|---|
| API processes | Single Node process by default; production cluster mode with `CLUSTER_WORKERS` (schedulers run only on worker 1) | Size the database before adding workers |
| Hosting | One droplet | Vertical scaling; a second region requires replicated PostgreSQL and shared Redis |
| Database | PostgreSQL with indexes on hot paths (ledger by account/group/reference, transfers by state, provider calls by provider/time) | Partition or archive append-only tables as they grow (no retention job yet) |
| Contention | Row-level locks only where needed (wallet conditional updates, pool reservation, escrow); no global locks | Hot wallets (e.g. a large business) serialise their own writes by design |
| Rate limits | Redis-backed, per IP / per key / per staff member | Without Redis, per-process counters |
| Background work | In-process intervals (remittance 15 s, reconciliation 30 min, ledger check 5 min, webhooks 15 s) | Move to a job queue for horizontal scaling |
| Reconciliation queries | Aggregate SQL over full ledger tables | Cost grows with history; incremental reconciliation needed at scale |
| Business batches | Up to 500 lines, executed line by line in separate transactions | Background execution for very large batches |
| Real-time | Socket.IO for messages and activity | Needs a Redis adapter for multi-process fan-out |
