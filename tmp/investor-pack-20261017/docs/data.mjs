// Shared facts for every document and the demo video. Financial figures come
// from financial-results.json, written by build-model.mjs from the workbook.
import fs from 'node:fs';
import path from 'node:path';
import { WORK, ROOT } from './lib.mjs';

export const fin = JSON.parse(fs.readFileSync(path.join(WORK, 'financial-results.json'), 'utf8'));
export const cases = fin.caseResults; // Downside / Base / Growth, years[0..4]
export const fee = Object.fromEntries(fin.feeExample.filter(r => r[0]).map(([k, v]) => [k, v]));
export const param = Object.fromEntries(fin.params.map(p => [p.key, p]));

export const sum = (c, k, n = 5) => cases[c].years.slice(0, n).reduce((a, y) => a + y[k], 0);
export const cumLoss = c => cases[c].years.reduce((a, y) => a + Math.min(0, y.result), 0);

export const deal = {
  total: 18e6, primary: 10e6, secondary: 8e6, stake: 0.40,
  post: 45e6, pre: 35e6, primaryPct: 10e6 / 45e6, secondaryPct: 8e6 / 45e6, founderAfter: 0.60,
};

export const platform = {
  models: 97, migrations: 58, endpoints: '400+', screens: 82, cockpitPages: 32, suites: 48, tests: 370,
  serverLines: '39k', mobileLines: '58k', webLines: '23k', riskRules: 17, staffRoles: 12, permissions: 49,
  corridors: 12, adapters: 9, replacementLow: 0.9e6, replacementHigh: 2.4e6, engMonthsLow: 72, engMonthsHigh: 122,
};

// CBL published actuals, Jan-Sep 2026 (official FX-use report, printed page 2).
export const cbl = {
  total: 19341501336, lcs: 10113469233, transfers: 2681416804, personal: 6507616299, months: 9,
  url: 'https://cbl.gov.ly/uses-of-foreign-exch/',
};

const V = p => path.join(ROOT, 'client/public/app', p);
const X = id => path.join(WORK, 'capture', id, 'clip.mp4');
const P = id => path.join(WORK, 'capture', id, 'poster.png');
const S = id => path.join(ROOT, 'client/public/app/screens/en-dark', id + '.webp');
// Chat clips with the app's unsubstantiated "End-to-end encrypted" banner painted out (sanitize/sanitize.mjs).
const Z = f => path.join(WORK, 'sanitize', f);

export const chapters = ['Everyday money', 'Social payments', 'FX and markets', 'Cross-border', 'Savings and community', 'Trust and security', 'Business', 'Arabic'];

// kind: ready = built and usable without an outside partner; partner = built, needs a bank, licence or payout partner;
// off = built but switched off in production until its conditions are met.
export const features = [
  { ch: 0, id: 'home', src: V('loops/en-dark/home.mp4'), still: S('home'), title: 'Home and balances', desc: 'Every currency and asset in one balance, with contacts and recent activity a thumb away.', kind: 'ready', status: 'Built' },
  { ch: 0, id: 'topup', src: V('loops/en-dark/topup.mp4'), still: S('topup'), title: 'Top up', desc: 'Bank transfer, P2P and cash top-up methods, each with its own instructions.', kind: 'partner', status: 'Built · awaits bank accounts' },
  { ch: 0, id: 'send', src: V('loops/en-dark/send.mp4'), still: S('send'), title: 'Send to anyone', desc: 'Pay by @handle, phone or contact. Risk checks and step-up verification run before money moves.', kind: 'ready', status: 'Built' },
  { ch: 0, id: 'receive', src: X('receive'), still: P('receive'), title: 'Receive by handle or QR', desc: 'A personal @handle, payment link and QR code that anyone can pay.', kind: 'ready', status: 'Built' },
  { ch: 0, id: 'claim', src: X('claim'), still: P('claim'), title: 'Claim links', desc: 'Send money to someone who is not on Tazdan yet. They join to claim it, so every payment is an invitation.', kind: 'ready', status: 'Built' },
  { ch: 0, id: 'history', src: X('history'), still: P('history'), title: 'Activity and receipts', desc: 'Every transaction with its reference, pending claim links and a receipt.', kind: 'ready', status: 'Built' },
  { ch: 0, id: 'statements', src: X('statements'), still: P('statements'), title: 'Statements', desc: 'Audit-ready PDF statements by period and currency, with balances, fees and the full ledger.', kind: 'ready', status: 'Built' },
  { ch: 1, id: 'messages', src: Z('messages.mp4'), still: S('messages'), title: 'Messaging', desc: 'Conversations with contacts, so money and messages live in the same place.', kind: 'ready', status: 'Built' },
  { ch: 1, id: 'chat-payment', src: Z('chat-payment.mp4'), still: Z('chat-payment-still.png'), title: 'Pay inside a chat', desc: 'Send money within a conversation and get a receipt in the thread.', kind: 'ready', status: 'Built' },
  { ch: 2, id: 'exchange', src: X('exchange'), still: P('exchange'), title: 'Currency exchange', desc: 'Convert between currencies. The rate includes the spread, and it is shown before you confirm.', kind: 'partner', status: 'Built · awaits FX permission' },
  { ch: 2, id: 'buy', src: V('loops/en-dark/buy.mp4'), still: S('buy'), title: 'Buy digital assets', desc: 'Quote, fees and confirmation in one flow, with limits checked before the confirm step.', kind: 'off', status: 'Real-money trading off' },
  { ch: 2, id: 'asset', src: V('loops/en-dark/asset.mp4'), still: S('asset'), title: 'Asset detail', desc: 'Live charts, holdings and performance for each asset.', kind: 'ready', status: 'Built · market data', max: 7.5 },
  { ch: 2, id: 'portfolio', src: X('portfolio'), still: P('portfolio'), title: 'Portfolio', desc: 'Allocation and performance across holdings.', kind: 'ready', status: 'Built' },
  { ch: 2, id: 'recurring', src: X('recurring'), still: P('recurring'), title: 'Recurring buys', desc: 'Schedule purchases weekly or monthly from a chosen balance.', kind: 'off', status: 'Off with trading' },
  { ch: 3, id: 'remit', src: V('loops/en-dark/remit.mp4'), still: S('remit'), title: 'Send abroad', desc: 'Corridor quote, recipient, review and tracking. Twelve corridors are configured, including the UK, Egypt, Turkey, UAE, the euro area and Tunisia.', kind: 'partner', status: 'Sandbox · payout partner pending' },
  { ch: 3, id: 'withdraw', src: X('withdraw'), still: P('withdraw'), title: 'Withdrawals', desc: 'Withdraw any balance to a bank or wallet, with screening and risk review on every request.', kind: 'partner', status: 'Built · manual bank payouts' },
  { ch: 3, id: 'linked', src: X('linked'), still: P('linked'), title: 'Linked banks and cards', desc: 'Manage payment methods in one place.', kind: 'partner', status: 'Awaits bank and card partners' },
  { ch: 3, id: 'cards', src: V('loops/en-dark/cards.mp4'), still: S('cards'), title: 'Cards', desc: 'Virtual and physical card controls and card activity.', kind: 'off', status: 'Off until an issuer is signed' },
  { ch: 4, id: 'budgets', src: V('loops/en-dark/budgets.mp4'), still: S('budgets'), title: 'Savings goals', desc: 'Goals like Hajj 2027, with scheduled contributions and a lock until the goal date.', kind: 'ready', status: 'Built' },
  { ch: 4, id: 'p2p', src: V('loops/en-dark/p2p.mp4'), still: S('p2p'), title: 'P2P marketplace', desc: 'Person-to-person offers with escrow and disputes. Sellers show a first name, last initial and coarse area only.', kind: 'off', status: 'Built · off by default in production' },
  { ch: 4, id: 'referral', src: X('referral'), still: P('referral'), title: 'Referrals', desc: 'A personal code with tracked invites and rewards for both sides.', kind: 'ready', status: 'Built' },
  { ch: 5, id: 'kyc', src: X('kyc'), still: P('kyc'), title: 'Identity verification', desc: 'Three verification levels. Limits are shown live and before any confirm step.', kind: 'ready', status: 'Built · manual review' },
  { ch: 5, id: 'security', src: V('loops/en-dark/settings.mp4'), still: S('devices'), title: 'Security centre', desc: 'Two-factor authentication, trusted devices and remote sign-out of other sessions.', kind: 'ready', status: 'Built' },
  { ch: 5, id: 'privacy', src: V('loops/en-dark/privacy-hidden.mp4'), still: S('privacy-hidden'), title: 'Privacy mode', desc: 'Hide balances with one tap in public. Market prices stay visible.', kind: 'ready', status: 'Built' },
  { ch: 6, id: 'business', src: V('loops/en-dark/business-home.mp4'), still: S('business-home'), title: 'Business accounts', desc: 'Verified business profiles with bulk pay and a second approver above set thresholds.', kind: 'ready', status: 'Built · internal recipients' },
  { ch: 6, id: 'business-team', src: X('business-team'), still: P('business-team'), title: 'Team and roles', desc: 'Owner, admin, analyst and developer roles with invitations.', kind: 'ready', status: 'Built' },
  { ch: 6, id: 'business-payouts', src: X('business-payouts'), still: P('business-payouts'), title: 'Payout approvals', desc: 'Batches wait for approval above the dual-control threshold, then show their status line by line.', kind: 'ready', status: 'Built' },
  { ch: 6, id: 'business-keys', src: X('business-keys'), still: P('business-keys'), title: 'API keys and webhooks', desc: 'Scoped, expiring API keys and signed webhooks for business integrations.', kind: 'ready', status: 'Built' },
  { ch: 7, id: 'arabic', src: V('video/ar-dark/tour-home.mp4'), still: path.join(ROOT, 'client/public/app/screens/ar-dark/home.webp'), title: 'Full Arabic, right to left', desc: 'The app in Arabic with a right-to-left layout. Currency names and amounts stay left to right.', kind: 'ready', status: 'Built', max: 8.5 },
];

export const statusCounts = features.reduce((a, f) => (a[f.kind] = (a[f.kind] || 0) + 1, a), {});
