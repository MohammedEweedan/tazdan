/**
 * Realistic mock data for the demo. Replace these with live API calls when
 * the backend is wired up — every service file below already routes through
 * a `useMock` flag so we can flip in one place.
 */

import type {
  CardEntity, MarketTicker, P2POffer, Transaction, User, Wallet,
} from '@/types';

export const MOCK_USER: User = {
  id: 'usr_demo',
  email: 'rayan@fortuni.app',
  username: 'rayofsunshine',
  firstName: 'Rayan',
  lastName: 'Zahi',
  avatarUrl: undefined,
  country: 'AE',
  kycStatus: 'APPROVED',
  kycTier: 'TIER_2',
  twoFactorEnabled: true,
  referralCode: 'RAYAN42',
  createdAt: '2025-01-12T00:00:00Z',
};

export const MOCK_WALLETS: Wallet[] = [
  { id: 'w_usdt', currency: 'USDT', balance: '41120.00',  frozen: '0', fiatValueUsd: '41120.00' },
  { id: 'w_btc',  currency: 'BTC',  balance: '0.314',     frozen: '0', fiatValueUsd: '20410.00', changePct24h: 1.42 },
  { id: 'w_eth',  currency: 'ETH',  balance: '4.82',      frozen: '0', fiatValueUsd: '15424.00', changePct24h: -0.86 },
  { id: 'w_sol',  currency: 'SOL',  balance: '85.6',      frozen: '0', fiatValueUsd: '12840.00', changePct24h: 3.21 },
  { id: 'w_usd',  currency: 'USD',  balance: '11444.28',  frozen: '0', fiatValueUsd: '11444.28' },
  { id: 'w_eur',  currency: 'EUR',  balance: '8200.00',   frozen: '0', fiatValueUsd: '8856.00' },
  { id: 'w_aed',  currency: 'AED',  balance: '38000.00',  frozen: '0', fiatValueUsd: '10336.00' },
  { id: 'w_gbp',  currency: 'GBP',  balance: '2200.00',   frozen: '0', fiatValueUsd: '2750.00' },
];

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', type: 'RECEIVE', status: 'COMPLETED', currency: 'USDT', amount: '+1114.20',  counterpartyHandle: '@moe.ali',       counterpartyName: 'Moe Ali',        reference: 'TX-001', createdAt: minutesAgo(0) },
  { id: 't2', type: 'BUY',     status: 'COMPLETED', currency: 'BTC',  amount: '+0.0123',   note: 'Market buy',                                                                            reference: 'TX-002', createdAt: minutesAgo(8) },
  { id: 't3', type: 'SEND',    status: 'COMPLETED', currency: 'USDT', amount: '-280.00',   counterpartyHandle: '@rahma.a',       counterpartyName: 'Rahma A',        note: 'Coffee ☕',     reference: 'TX-003', createdAt: minutesAgo(34) },
  { id: 't4', type: 'CARD_SPEND', status: 'COMPLETED', currency: 'USDT', amount: '-42.50', counterpartyName: 'Apple',            note: 'Apple iCloud+',                                   reference: 'TX-004', createdAt: minutesAgo(120) },
  { id: 't5', type: 'TOPUP',   status: 'PROCESSING', currency: 'USD',  amount: '+500.00',  note: 'Visa •• 4421',                                                                          reference: 'TX-005', createdAt: minutesAgo(180) },
  { id: 't6', type: 'P2P_BUY', status: 'COMPLETED', currency: 'USDT', amount: '+5000.00',  counterpartyHandle: '@trader.uae',   counterpartyName: 'Sami (UAE)',     note: 'AED→USDT',     reference: 'TX-006', createdAt: minutesAgo(360) },
  { id: 't7', type: 'WITHDRAWAL', status: 'COMPLETED', currency: 'USDT', amount: '-1200.00', note: 'TRC20 withdrawal',                                                                    reference: 'TX-007', createdAt: minutesAgo(720) },
  { id: 't8', type: 'CASHBACK', status: 'COMPLETED', currency: 'USDT', amount: '+3.20',    note: '1% on Apple purchase',                                                                  reference: 'TX-008', createdAt: minutesAgo(1440) },
];

const sparkline = (base: number, vol: number, n = 24) => {
  const out: number[] = [];
  let last = base;
  for (let i = 0; i < n; i++) {
    last = last + (Math.sin(i / 3) + Math.cos(i / 5)) * vol + (Math.random() - 0.5) * vol * 0.5;
    out.push(Number(last.toFixed(2)));
  }
  return out;
};

export const MOCK_MARKETS: MarketTicker[] = [
  { symbol: 'BTCUSDT',   base: 'BTC',   quote: 'USDT', displayName: 'Bitcoin',    price: 65_240,  changePct24h:  1.42, volume24h: 32_400_000_000, sparkline: sparkline(65_000, 800) },
  { symbol: 'ETHUSDT',   base: 'ETH',   quote: 'USDT', displayName: 'Ethereum',   price:  3_215,  changePct24h: -0.86, volume24h: 14_200_000_000, sparkline: sparkline(3_200, 25) },
  { symbol: 'SOLUSDT',   base: 'SOL',   quote: 'USDT', displayName: 'Solana',     price:    150,  changePct24h:  3.21, volume24h:  2_100_000_000, sparkline: sparkline(150, 3) },
  { symbol: 'BNBUSDT',   base: 'BNB',   quote: 'USDT', displayName: 'BNB',        price:    602,  changePct24h:  0.42, volume24h:  1_200_000_000, sparkline: sparkline(600, 5) },
  { symbol: 'XRPUSDT',   base: 'XRP',   quote: 'USDT', displayName: 'XRP',        price:   0.55,  changePct24h: -1.02, volume24h:    900_000_000, sparkline: sparkline(0.55, 0.01) },
  { symbol: 'ADAUSDT',   base: 'ADA',   quote: 'USDT', displayName: 'Cardano',    price:   0.45,  changePct24h:  2.14, volume24h:    400_000_000, sparkline: sparkline(0.45, 0.008) },
];

export const MOCK_P2P_OFFERS: P2POffer[] = [
  { id: 'p1', side: 'SELL', trader: { handle: '@trader.uae', name: 'Sami',   rating: 4.9, orders: 1240, verified: true,  anonymous: false }, base: 'USDT', quote: 'AED',  price: '3.68',  available: '20000', minLimit: '500',  maxLimit: '5000',  paymentMethods: ['Bank Transfer', 'Apple Pay'], country: 'AE' },
  { id: 'p2', side: 'SELL', trader: { handle: '@fast.sa',     name: 'Khalid', rating: 4.8, orders:  820, verified: true,  anonymous: false }, base: 'USDT', quote: 'SAR',  price: '3.75',  available: '15000', minLimit: '300',  maxLimit: '4000',  paymentMethods: ['Bank Transfer'],            country: 'SA' },
  { id: 'p3', side: 'BUY',  trader: { handle: '@global.trader',name: 'Lina',  rating: 5.0, orders: 2100, verified: true,  anonymous: false }, base: 'BTC',  quote: 'USDT', price: '65180', available:  '0.4',  minLimit: '0.01', maxLimit: '0.5',   paymentMethods: ['Internal Wallet'],          country: 'EG' },
  { id: 'p4', side: 'SELL', trader: { handle: '@quickly',     name: 'Omar',   rating: 4.7, orders:  650, verified: false, anonymous: false }, base: 'USDT', quote: 'EGP',  price: '49.00', available: '12000', minLimit: '100',  maxLimit: '3000',  paymentMethods: ['Vodafone Cash', 'Bank'],    country: 'EG' },
];

export const MOCK_CARDS: CardEntity[] = [
  { id: 'c1', tier: 'PRO',     status: 'ACTIVE', last4: '1144', expiryMonth: 11, expiryYear: 2029, cardHolder: 'RAYAN ZAHI', currency: 'USDT', spentMonth: '4214.20', dailyLimit: '5000', monthlyLimit: '50000', cashbackBalance: '142.60', frozen: false, colorway: 'sapphire' },
  { id: 'c2', tier: 'MASTER',  status: 'ACTIVE', last4: '8821', expiryMonth: 4,  expiryYear: 2028, cardHolder: 'RAYAN ZAHI', currency: 'USDT', spentMonth: '1014.00', dailyLimit: '2500', monthlyLimit: '25000', cashbackBalance:  '34.80', frozen: false, colorway: 'obsidian' },
];
