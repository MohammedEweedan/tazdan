/**
 * Pre-flight environment check.
 * Run before every deployment: npx ts-node --transpile-only scripts/preflight.ts
 * Exits with code 1 if any CRITICAL checks fail.
 */
import * as crypto from 'crypto';

interface Check {
  name: string;
  level: 'CRITICAL' | 'WARN' | 'INFO';
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(name: string, level: Check['level'], pass: boolean, detail?: string) {
  checks.push({ name, level, pass, detail });
}

const env = process.env;
const isProd = env.NODE_ENV === 'production';

// ── Secrets ──────────────────────────────────────────────────────────
check('NODE_ENV is set', 'CRITICAL', !!env.NODE_ENV, env.NODE_ENV);
check('DATABASE_URL set', 'CRITICAL', !!env.DATABASE_URL);
check('JWT_SECRET set', 'CRITICAL', !!env.JWT_SECRET);
check('JWT_SECRET length ≥ 32', 'CRITICAL', (env.JWT_SECRET?.length ?? 0) >= 32);
check('JWT_REFRESH_SECRET set', 'CRITICAL', !!env.JWT_REFRESH_SECRET);
check('JWT_REFRESH_SECRET ≠ JWT_SECRET', 'CRITICAL',
  !isProd || env.JWT_REFRESH_SECRET !== env.JWT_SECRET,
  isProd ? undefined : 'skipped in dev');
check('MASTER_SEED_ENC_KEY set', 'CRITICAL', !!env.MASTER_SEED_ENC_KEY);
check('MASTER_SEED_ENC_KEY is 64 hex chars', 'CRITICAL',
  /^[0-9a-fA-F]{64}$/.test(env.MASTER_SEED_ENC_KEY ?? ''));

// Detect placeholder values
const PLACEHOLDER = /^(change_me|todo|test|example|placeholder|your_)/i;
check('JWT_SECRET is not placeholder', 'CRITICAL', !PLACEHOLDER.test(env.JWT_SECRET ?? ''));
check('MASTER_SEED_ENC_KEY is not all zeros', 'CRITICAL',
  env.MASTER_SEED_ENC_KEY !== '0'.repeat(64));

// ── Network ──────────────────────────────────────────────────────────
check('CLIENT_URL set', 'CRITICAL', !!env.CLIENT_URL);
check('CLIENT_URL is https in prod', isProd ? 'CRITICAL' : 'WARN',
  !isProd || (env.CLIENT_URL ?? '').startsWith('https://'));

// ── Email & Notifications ────────────────────────────────────────────
check('SMTP_HOST set', isProd ? 'WARN' : 'INFO', !!env.SMTP_HOST);
check('SMTP_USER set', isProd ? 'WARN' : 'INFO', !!env.SMTP_USER);
check('TWILIO_ACCOUNT_SID set', 'WARN', !!env.TWILIO_ACCOUNT_SID);

// ── Blockchain ───────────────────────────────────────────────────────
check('ALCHEMY_API_KEY or ALCHEMY_RPC_URL set', isProd ? 'WARN' : 'INFO',
  !!(env.ALCHEMY_API_KEY || env.ALCHEMY_RPC_URL),
  'Required for ETH/ERC-20 on-chain settlement');
check('SOLANA_RPC_URL set', 'INFO', !!env.SOLANA_RPC_URL);

// ── Monitoring ───────────────────────────────────────────────────────
check('SENTRY_DSN set', isProd ? 'WARN' : 'INFO', !!env.SENTRY_DSN);

// ── Security ─────────────────────────────────────────────────────────
check('ADMIN_EMAIL set', 'CRITICAL', !!env.ADMIN_EMAIL);
check('ADMIN_PASSWORD set', 'CRITICAL', !!env.ADMIN_PASSWORD);
check('ADMIN_PASSWORD length ≥ 12', 'CRITICAL', (env.ADMIN_PASSWORD?.length ?? 0) >= 12);
check('ADMIN_PASSWORD not default', 'CRITICAL',
  !['password', 'admin', 'fortuni', '123456'].includes((env.ADMIN_PASSWORD ?? '').toLowerCase()));

// ── Redis ────────────────────────────────────────────────────────────
check('REDIS_URL set', 'WARN', !!env.REDIS_URL,
  'Redis required for quote cache and session management at scale');

// ── KYC ──────────────────────────────────────────────────────────────
check('KYC_PROVIDER set', isProd ? 'WARN' : 'INFO',
  !!env.KYC_PROVIDER && env.KYC_PROVIDER !== 'mock',
  `current: ${env.KYC_PROVIDER ?? 'not set'}`);
check('SUMSUB_APP_TOKEN set', env.KYC_PROVIDER === 'SUMSUB' ? 'CRITICAL' : 'INFO',
  !!env.SUMSUB_APP_TOKEN, 'required when KYC_PROVIDER=SUMSUB');
check('SUMSUB_SECRET set', env.KYC_PROVIDER === 'SUMSUB' ? 'CRITICAL' : 'INFO',
  !!env.SUMSUB_SECRET, 'required when KYC_PROVIDER=SUMSUB');
check('SUMSUB_WEBHOOK_SECRET set', env.KYC_PROVIDER === 'SUMSUB' ? 'WARN' : 'INFO',
  !!env.SUMSUB_WEBHOOK_SECRET, 'webhook verification; strongly recommended in production');

// ── On-ramp (card payments) ───────────────────────────────────────────
check('ONRAMP_PROVIDER set', isProd ? 'WARN' : 'INFO',
  !!env.ONRAMP_PROVIDER && env.ONRAMP_PROVIDER !== 'MOCK',
  `current: ${env.ONRAMP_PROVIDER ?? 'not set'}`);
check('CHECKOUT_SECRET_KEY set', env.ONRAMP_PROVIDER === 'CHECKOUT' ? 'CRITICAL' : 'INFO',
  !!env.CHECKOUT_SECRET_KEY, 'required when ONRAMP_PROVIDER=CHECKOUT');
check('CHECKOUT_WEBHOOK_SECRET set', env.ONRAMP_PROVIDER === 'CHECKOUT' ? 'WARN' : 'INFO',
  !!env.CHECKOUT_WEBHOOK_SECRET, 'Cko-Signature webhook verification');

// ── Deposit webhooks ──────────────────────────────────────────────────
check('ALCHEMY_WEBHOOK_SIGNING_KEY set', isProd ? 'WARN' : 'INFO',
  !!env.ALCHEMY_WEBHOOK_SIGNING_KEY, 'HMAC verification for EVM on-chain deposits');
check('TRON_WEBHOOK_API_KEY set', isProd ? 'WARN' : 'INFO',
  !!env.TRON_WEBHOOK_API_KEY, 'API key verification for TRC-20 USDT deposits');

// ── Print results ────────────────────────────────────────────────────
const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';

console.log(`\n${BOLD}fortuni pre-flight environment check${RESET}`);
console.log(`NODE_ENV: ${CYAN}${env.NODE_ENV ?? 'not set'}${RESET}\n`);

let criticalFails = 0;
let warnFails = 0;

for (const c of checks) {
  const icon  = c.pass ? `${GREEN}✓${RESET}` : (c.level === 'CRITICAL' ? `${RED}✗${RESET}` : `${YELLOW}⚠${RESET}`);
  const label = c.pass ? c.name : `${c.level === 'CRITICAL' ? RED : YELLOW}${c.name}${RESET}`;
  const detail = c.detail ? ` (${c.detail})` : '';
  console.log(`  ${icon} ${label}${detail}`);
  if (!c.pass) {
    if (c.level === 'CRITICAL') criticalFails++;
    if (c.level === 'WARN') warnFails++;
  }
}

console.log(`\n${BOLD}Summary:${RESET}`);
console.log(`  ${GREEN}${checks.filter(c => c.pass).length} passed${RESET}`);
if (warnFails) console.log(`  ${YELLOW}${warnFails} warnings${RESET}`);
if (criticalFails) console.log(`  ${RED}${criticalFails} critical failures${RESET}`);

if (criticalFails > 0) {
  console.log(`\n${RED}${BOLD}DEPLOYMENT BLOCKED — fix critical failures first.${RESET}\n`);
  process.exit(1);
} else if (warnFails > 0) {
  console.log(`\n${YELLOW}${BOLD}Warnings present — review before deploying to production.${RESET}\n`);
} else {
  console.log(`\n${GREEN}${BOLD}All checks passed — ready to deploy.${RESET}\n`);
}
