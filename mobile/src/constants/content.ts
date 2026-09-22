/**
 * UX Copy — empty states, errors, onboarding, validation.
 * Award-winning products obsess over every word.
 */

export const COPY = {
  empty: {
    wallet: {
      title: 'Your wallet is waiting',
      body: 'Add funds to start trading crypto and fiat instantly.',
      cta: 'Deposit Now',
    },
    p2p: {
      title: 'No offers yet',
      body: 'Be the first to post an offer or check back in a few minutes.',
      cta: 'Create Offer',
    },
    transactions: {
      title: 'No transactions',
      body: 'Your activity will appear here once you make your first move.',
    },
    holdings: {
      title: 'No holdings yet',
      body: 'Buy your first crypto to see it here.',
      cta: 'Buy Crypto',
    },
    search: {
      title: 'No results found',
      body: 'Try a different keyword or check your spelling.',
    },
  },

  error: {
    network: "Connection issue. We'll retry automatically.",
    timeout: 'This is taking longer than usual. Please wait…',
    biometricFail: 'Unable to verify. You can use your passcode instead.',
    generic: 'Something went wrong. Please try again.',
    insufficientFunds: 'Insufficient balance for this transaction.',
    invalidAmount: 'Please enter a valid amount.',
    kycRequired: 'Complete identity verification to use this feature.',
  },

  success: {
    deposit: 'Deposit submitted successfully',
    withdraw: 'Withdrawal requested successfully',
    buy: 'Purchase completed',
    sell: 'Sale completed',
    send: 'Transfer sent',
    saved: 'Changes saved',
  },

  onboarding: {
    step1: {
      title: 'Arab roots. Crypto. Connected.',
      body: 'Bring everyday money and supported crypto together, from Libya to the wider Arab world.',
    },
    step2: {
      title: 'Your crypto, connected',
      body: 'Manage supported assets and choose the correct network when sending or receiving.',
    },
    step3: {
      title: 'Trade with people',
      body: 'Explore P2P offers in LYD and regional currencies, with terms shown before you trade.',
    },
  },

  validation: {
    password: { min: 8, max: 128, requireSpecial: true, message: 'Password must be at least 8 characters with a special character.' },
    username: { min: 3, max: 30, regex: /^[a-zA-Z0-9_]+$/, message: 'Username must be 3–30 characters, alphanumeric only.' },
    amount: { min: 0.01, max: 999_999_999, message: 'Amount must be between 0.01 and 999,999,999.' },
    note: { max: 280, message: 'Note must be 280 characters or less.' },
    address: { min: 10, message: 'Please enter a valid wallet address.' },
    reference: { min: 3, max: 50, message: 'Reference must be 3–50 characters.' },
  },
} as const;

export const CURRENCY_DESCRIPTIONS: Record<string, string> = {
  BTC: 'The original cryptocurrency — decentralized digital gold.',
  ETH: 'Smart contract platform powering DeFi and NFTs.',
  SOL: 'High-speed blockchain with low transaction costs.',
  USDT: 'Stablecoin pegged to the US dollar.',
  BNB: 'Utility token for the Binance ecosystem.',
  XRP: 'Fast, low-cost cross-border payment network.',
  ADA: 'Peer-reviewed blockchain with a focus on sustainability.',
  DOGE: 'Community-driven cryptocurrency that started as a meme.',
  MATIC: 'Layer-2 scaling solution for Ethereum.',
  DOT: 'Multi-chain protocol enabling blockchain interoperability.',
  AVAX: 'High-throughput platform for custom blockchain networks.',
  LYD: 'Libyan Dinar — everyday money at home.',
  USD: 'United States Dollar — the global reserve currency.',
  EUR: 'Euro — official currency of the Eurozone.',
  GBP: 'British Pound Sterling.',
  AED: 'UAE Dirham — official currency of the United Arab Emirates.',
  SAR: 'Saudi Riyal — official currency of Saudi Arabia.',
  EGP: 'Egyptian Pound — official currency of Egypt.',
};
