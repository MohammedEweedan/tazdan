/**
 * Builds the widget snapshot from what the app already has in its query
 * cache — no extra requests, no price socket. Titles, directions and money
 * formatting follow the home screen's activity list.
 */
import { fiatSymbol, getCurrencyMeta } from '@/constants';
import { translate, translateLiteral, type Locale } from '@/store/i18nStore';
import { formatMoney } from '@/utils/format';
import type { Activity } from '@/services';
import type { Currency, MarketTicker, Wallet } from '@/types';
import type { Conversation } from '@/types/messages';
import type { LiveFiat } from '@/hooks/useForexRates';
import {
  MASK, type WidgetChat, type WidgetHolding, type WidgetPayment, type WidgetSnapshot,
} from './snapshot';

const FIAT = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND', 'CHF', 'CAD', 'JPY', 'AUD']);
const USD_LIKE = new Set(['USD', 'USDT', 'USDC']);
const CRYPTO_SYMBOLS: Record<string, string> = { USDT: '$', BTC: '₿', ETH: 'Ξ', BNB: 'B', SOL: '◎' };

// Same sets as the home activity list.
const INCOMING = new Set(['DEPOSIT', 'TRANSFER_IN', 'RECEIVE', 'SELL', 'P2P_BUY', 'CASHBACK', 'ADMIN_CREDIT', 'REFERRAL_REWARD']);
const TRADES = new Set(['BUY', 'SELL', 'SWAP']);
const PENDING = new Set(['PENDING', 'WAITING_CONFIRMATION', 'PROCESSING', 'QUEUED', 'SUBMITTED', 'IN_PROGRESS', 'AWAITING_ESCROW', 'ESCROW_FUNDED', 'PAYMENT_SENT',
  'COMPLIANCE_PENDING', 'MANUAL_REVIEW', 'FUNDING_PENDING', 'FUNDED', 'ROUTING', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'PAYOUT_PENDING']);
const FAILED = new Set(['FAILED', 'REJECTED', 'CANCELLED', 'DECLINED', 'EXPIRED', 'REFUNDED']);

export interface WidgetInputs {
  locale: Locale;
  apiBase: string;
  hidden: boolean;
  showChatPreview: boolean;
  meId: string;
  baseCurrency: string;
  wallets: Wallet[];
  tickers: MarketTicker[];
  /** GET /rates — units of each currency per USD. */
  ratesPerUsd: Record<string, number>;
  liveFiat: Record<string, LiveFiat>;
  activities: Activity[];
  conversations: Conversation[];
}

const code = (c: string) => c.toUpperCase().replace(/_(ERC20|TRC20|BEP20)$/, '');

function display(i: WidgetInputs): WidgetSnapshot['display'] {
  const c = i.baseCurrency.toUpperCase();
  if (c === 'USD') return { code: c, symbol: fiatSymbol('USD', i.locale), perUsd: 1, decimals: 2, symbolAfter: false };
  if (FIAT.has(c)) {
    const symbol = fiatSymbol(c, i.locale);
    return { code: c, symbol, perUsd: i.ratesPerUsd[c] ?? 1, decimals: 2, symbolAfter: symbol === 'د.إ' || symbol === '﷼' || symbol === 'E£' };
  }
  const price = i.tickers.find((t) => t.base === c)?.price;
  return { code: c, symbol: CRYPTO_SYMBOLS[c] ?? `${c} `, perUsd: price && price > 0 ? 1 / price : 1, decimals: c === 'BTC' ? 6 : 4, symbolAfter: false };
}

function holdings(i: WidgetInputs): WidgetHolding[] {
  const amounts = new Map<string, number>();
  for (const w of i.wallets) {
    const amount = Number(w.balance);
    if (!(amount > 0)) continue;
    const c = code(w.currency);
    amounts.set(c, (amounts.get(c) ?? 0) + amount);
  }
  const out: WidgetHolding[] = [];
  for (const [c, amount] of amounts) {
    const kind: WidgetHolding['kind'] = FIAT.has(c) ? 'fiat' : 'crypto';
    const ticker = i.tickers.find((t) => t.base === c);
    const live = i.liveFiat[c];
    const perUsd = i.ratesPerUsd[c];
    const usdPrice = USD_LIKE.has(c) ? 1
      : kind === 'crypto' ? (ticker?.price ?? 0)
      : live?.usd ?? (perUsd && perUsd > 0 ? 1 / perUsd : 0);
    // Without a price there is no honest value to show.
    if (!(usdPrice > 0)) continue;
    out.push({
      code: c,
      name: getCurrencyMeta(c)?.name ?? c,
      kind,
      amount,
      usdPrice,
      change24hPct: kind === 'crypto' ? (ticker?.changePct24h ?? null) : (live?.change24hPct ?? null),
    });
  }
  return out.sort((a, b) => b.amount * b.usdPrice - a.amount * a.usdPrice).slice(0, 8);
}

function payments(i: WidgetInputs): WidgetPayment[] {
  return i.activities.slice(0, 6).map((a) => {
    const meta = (a.metadata ?? {}) as Record<string, any>;
    const type = a.type;
    const amt = Number(a.amount);
    const cp = meta.counterpartyName ?? a.counterparty?.name ?? a.counterparty?.username ?? null;
    const asset = meta.asset ?? a.currency;
    const assetName = getCurrencyMeta(asset)?.name ?? asset;
    let title: string;
    if      (type === 'BUY')          title = `Bought ${assetName}`;
    else if (type === 'SELL')         title = `Sold ${assetName}`;
    else if (type === 'DEPOSIT')      title = 'Top-up';
    else if (type === 'WITHDRAW' || type === 'WITHDRAWAL') title = 'Withdrawal';
    else if (type === 'TRANSFER_IN' || type === 'RECEIVE') title = cp ?? 'Received';
    else if (type === 'TRANSFER_OUT' || type === 'SEND')   title = cp ?? 'Sent';
    else if (type === 'SWAP')         title = `Converted to ${assetName}`;
    else if (type === 'CARD_SPEND')   title = a.description ?? 'Card payment';
    else if (type === 'CASHBACK')     title = 'Cashback';
    else title = a.description ?? (type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' '));
    const status = String(a.status ?? '').toUpperCase();
    const incoming = INCOMING.has(type) || (!TRADES.has(type) && amt > 0);
    const settleCcy = (meta.settlementCurrency ?? a.currency) as Currency;
    const settleAbs = meta.settlementAmount != null ? Math.abs(Number(meta.settlementAmount)) : Math.abs(amt);
    return {
      id: a.id,
      title: translateLiteral(title, i.locale) ?? title,
      amountText: i.hidden ? MASK : `${incoming ? '+' : '−'}${formatMoney(settleAbs, settleCcy, { showSymbol: true })}`,
      incoming,
      failed: FAILED.has(status),
      pending: PENDING.has(status),
      at: a.createdAt,
    };
  });
}

function chats(i: WidgetInputs): WidgetSnapshot['chats'] {
  const newMessage = translate('widget.newMessage', i.locale);
  const items: WidgetChat[] = i.conversations.slice(0, 4).map((c) => {
    const p = c.partner;
    const support = p.username?.toLowerCase() === 'support';
    const name = support
      ? translate('widget.support', i.locale)
      : `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || (p.username ? `@${p.username}` : '—');
    const m = c.lastMessage;
    let preview = '';
    if (!i.showChatPreview) preview = c.unread ? newMessage : '';
    else if (m.deletedAt) preview = '';
    else if ((m.type === 'PAYMENT' || m.type === 'REQUEST') && m.metadata) {
      preview = i.hidden ? MASK : `${m.metadata.amount} ${m.metadata.currency ?? ''}`.trim();
    } else if (m.type === 'STICKER' && m.metadata) preview = `${m.metadata.emoji ?? ''} ${m.metadata.label ?? ''}`.trim();
    else preview = m.content.replace(/\s+/g, ' ').slice(0, 90);
    return {
      partnerId: p.id,
      name,
      initial: (p.firstName?.[0] ?? p.username?.[0] ?? '?').toUpperCase(),
      preview,
      unread: c.unread,
      at: m.createdAt,
      support,
    };
  });
  return { unread: i.conversations.reduce((s, c) => s + c.unread, 0), items };
}

export function buildWidgetSnapshot(i: WidgetInputs): WidgetSnapshot {
  const l = (k: string) => translate(k, i.locale);
  return {
    v: 1,
    updatedAt: new Date().toISOString(),
    locale: i.locale === 'ar' ? 'ar' : 'en',
    apiBase: i.apiBase,
    hidden: i.hidden,
    labels: {
      payments: l('widget.payments'), send: l('quick.send'), receive: l('quick.receive'),
      scan: l('widget.scan'), topUp: l('quick.topUp'), noPayments: l('widget.noPayments'),
      chats: l('widget.chats'), noChats: l('widget.noChats'), unread: l('widget.unread'),
      newMessage: l('widget.newMessage'), assets: l('home.assets'), total: l('home.totalBalance'),
      noAssets: l('widget.noAssets'), updated: l('widget.updated'), openApp: l('widget.openApp'),
    },
    display: display(i),
    holdings: holdings(i),
    payments: payments(i),
    chats: chats(i),
  };
}
