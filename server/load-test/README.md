# Fortuni Load Test — 100k-Scale

## What this tests

Compresses a full year of 100 k-user activity into ~12 minutes using k6.

| Stage | Duration | VUs | Equivalent |
|-------|----------|-----|------------|
| Ramp-up | 2 min | 0 → 500 | Morning open |
| Sustained | 3 min | 500 | Business hours |
| Spike | 2 min | 500 → 1,500 | Lunch rush |
| Peak | 2 min | 1,500 | Max load (≈ 100k active) |
| Ramp-down | 2 min | 1,500 → 0 | EOD cooldown |

Each VU ≈ 67 real users (1,500 × 67 ≈ 100,000).

## Traffic mix per VU session

1. **Register + activate** (every VU, once)
2. **Wallet reads** — portfolio, balances (every session)
3. **Market data** — ticker reads
4. **Order** — BUY (every session), SELL (30%)
5. **Activity mix** (weighted):
   - 15% — browse P2P listings
   - 15% — profile + activity feed reads
   - 10% — P2P listing creation
   - 10% — messaging/conversations
   - 10% — deposit history
   - 10% — notification reads
   - 10% — withdrawal history
   - 8%  — wallet swap
   - 7%  — card management
   - 5%  — misc

## Install k6

```bash
brew install k6
```

## Run the test

```bash
# Make sure the server is running first:
# cd server && npm run dev

# Basic run (against localhost)
k6 run server/load-test/k6.js

# Against a remote server
k6 run --env BASE_URL=http://your-server:5000/api server/load-test/k6.js

# Custom admin credentials
k6 run \
  --env BASE_URL=http://localhost:5000/api \
  --env ADMIN_EMAIL=admin@exchange.ly \
  --env ADMIN_PASSWORD='Admin123!@#' \
  server/load-test/k6.js

# With HTML report (requires xk6-dashboard or k6 cloud)
k6 run --out json=results.json server/load-test/k6.js
```

## Pass/Fail thresholds

| Metric | p95 | p99 |
|--------|-----|-----|
| All HTTP requests | < 800ms | < 2,000ms |
| Order placement | < 1,000ms | < 3,000ms |
| Transfers | < 1,200ms | < 4,000ms |
| Wallet reads | < 400ms | < 1,000ms |
| **Error rate** | **< 1%** | |

k6 exits with code 1 if any threshold is breached.

## Reading the output

```
http_req_duration............: avg=145ms  min=12ms  med=98ms  max=4.2s  p(90)=380ms p(95)=620ms
order_latency_ms.............: avg=210ms  p(95)=890ms  p(99)=2100ms
error_rate...................: 0.32%
```

- **p95 < 800ms** — 95% of users get a response in under 800ms ✓
- **error_rate < 1%** — less than 1 in 100 requests fail ✓
- `http_req_failed` — shows rate of non-2xx responses broken down

## What to watch on the server during the test

```bash
# DB connection pool usage
watch -n1 "psql $DATABASE_URL -c \"SELECT count(*) FROM pg_stat_activity WHERE state='active'\""

# Server process CPU/memory
top -pid $(pgrep -f "ts-node|node.*server")

# Live error log
npm run dev 2>&1 | grep -E "ERROR|error|500|failed"
```

## Bottlenecks to look for

| Symptom | Likely cause |
|---------|-------------|
| `order_latency_ms` p99 > 5s | DB lock contention on Wallet row during concurrent orders |
| `http_req_failed` > 2% | Rate limiter kicking in (see `index.ts` limiters) |
| Memory climbing past 1GB | Missing DB connection pool cap (check `DATABASE_URL?connection_limit=`) |
| `wallet_read_latency` p95 > 500ms | Missing index on `Wallet.userId` |
| Spike stage causes 10x latency jump | No horizontal scaling / single Node process |

## Quick fixes before a production load test

```bash
# Add DB connection limit to env
DATABASE_URL="postgresql://...?connection_limit=25&pool_timeout=10"

# Bump rate limiter in server/src/index.ts if you're testing your own infra
# (the default 100 req/15min is intentionally tight for auth endpoints)
```
