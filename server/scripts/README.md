# Platform Activity Simulator

This directory contains a comprehensive bot simulation script that tests all platform features by simulating realistic user behavior.

## Features Simulated

- **User Management**: Registration, login, profile operations
- **Wallets**: Balance checks, portfolio views, transaction history
- **Deposits**: Create deposits with various payment methods
- **Withdrawals**: Create withdrawals to banks and crypto wallets
- **Trading**: Place buy/sell orders with market prices
- **P2P Transfers**: Send USDT to other users
- **Agent Network**: Find agents, request cash deposits
- **Admin Dashboard**: View metrics, manage pending items, update rates

## Usage

### Basic Usage (from server directory)

```bash
# Run with default settings (10 users, 5 minutes)
npm run simulate

# Run with verbose output
npm run simulate:verbose

# Include admin simulation
npm run simulate:admin

# Full verbose with admin
npm run simulate:verbose -- --admin
```

### Advanced Options

```bash
# Custom number of users and duration
cd server && npx ts-node --transpile-only scripts/simulate-platform-activity.ts --users=20 --duration=10

# All options combined
cd server && npx ts-node --transpile-only scripts/simulate-platform-activity.ts --users=50 --duration=30 --admin --verbose
```

### Environment Variables

```bash
# Point to different API endpoint
API_URL=http://localhost:3001 npm run simulate

# Production testing (be careful!)
API_URL=https://api.yourdomain.com npm run simulate -- --users=5 --duration=2
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--users=N` | Number of simulated users | 10 |
| `--duration=M` | Duration in minutes | 5 |
| `--admin` | Include admin activity simulation | false |
| `--verbose` | Show detailed activity logs | false |

## Output Example

```
============================================================
  PLATFORM ACTIVITY SIMULATOR
============================================================
  API URL: http://localhost:3001
  Users: 10
  Duration: 5 minutes
  Admin simulation: Yes
============================================================

--- Iteration 1 ---

👤 User: simuser_1776025552666_0@test.com
  ✓ Registered: simuser_1776025552666_0@test.com
  ✓ Logged in: simuser_1776025552666_0@test.com
  ✓ Fetched 3 wallets
  ✓ Portfolio value: $0.00
  ✓ Deposit created: 250.50 LYD
  ✓ Deposit history: 1 records

🔐 Admin Session
  ✓ Admin logged in
  ✓ Dashboard: 45 users, 12 pending deposits

⏱️  4 minutes remaining
```

## Statistics Tracked

The simulator tracks:
- Registrations & Logins
- Deposits & Withdrawals
- Buy/Sell Orders
- P2P Transfers
- Agent Requests
- Errors encountered

## Safety Notes

⚠️ **Important**: This script creates real data in your database!

- Always run against a development/test database
- The script generates random email addresses like `simuser_{timestamp}_{index}@test.com`
- Use `--duration` to limit runtime
- Consider using `prisma migrate reset` before/after testing

## Troubleshooting

### Connection Errors
```bash
# Make sure server is running
curl http://localhost:3001/api/health
```

### Module Not Found
```bash
# Reinstall dependencies
cd server && npm install
```

### TypeScript Errors
```bash
# Run with transpile-only (skips strict type checking)
npx ts-node --transpile-only scripts/simulate-platform-activity.ts
```
