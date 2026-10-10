// Captures from the current Expo web build (10 October 2026).
// The fixture account uses illustrative data; the site identifies it as such.
export type AppMediaVariant = 'en-dark' | 'ar-dark' | 'en-light';
export const APP_SCREENS: Record<string, { variants: AppMediaVariant[]; caption: string; route: string }> = {
  "home": { variants: ['en-dark'] as AppMediaVariant[], caption: "home", route: "after-login" },
  "onboarding": { variants: ['en-dark'] as AppMediaVariant[], caption: "onboarding", route: "onboarding" },
  "wallet": { variants: ['en-dark'] as AppMediaVariant[], caption: "wallet", route: "_portfolio_fiat" },
  "balances": { variants: ['en-dark'] as AppMediaVariant[], caption: "balances", route: "after-login" },
  "asset": { variants: ['en-dark'] as AppMediaVariant[], caption: "asset", route: "_asset_BTC" },
  "portfolio": { variants: ['en-dark'] as AppMediaVariant[], caption: "portfolio", route: "_portfolio_crypto" },
  "send": { variants: ['en-dark'] as AppMediaVariant[], caption: "send", route: "_transfer" },
  "confirm": { variants: ['en-dark'] as AppMediaVariant[], caption: "confirm", route: "_transfer" },
  "receive": { variants: ['en-dark'] as AppMediaVariant[], caption: "receive", route: "_receive" },
  "claim": { variants: ['en-dark'] as AppMediaVariant[], caption: "claim", route: "_claim_demo_token" },
  "topup": { variants: ['en-dark'] as AppMediaVariant[], caption: "topup", route: "_topup" },
  "withdraw": { variants: ['en-dark'] as AppMediaVariant[], caption: "withdraw", route: "_withdraw" },
  "remit": { variants: ['en-dark'] as AppMediaVariant[], caption: "remit", route: "_remit" },
  "remit-track": { variants: ['en-dark'] as AppMediaVariant[], caption: "remit track", route: "_remit_rmt_omar" },
  "p2p": { variants: ['en-dark'] as AppMediaVariant[], caption: "p2p", route: "_p2p_trades" },
  "budgets": { variants: ['en-dark'] as AppMediaVariant[], caption: "budgets", route: "_budgets" },
  "chat-payment": { variants: ['en-dark'] as AppMediaVariant[], caption: "chat payment", route: "_chat_trd_escrow" },
  "privacy-hidden": { variants: ['en-dark'] as AppMediaVariant[], caption: "privacy hidden", route: "_settings" },
  "business-home": { variants: ['en-dark'] as AppMediaVariant[], caption: "business home", route: "_business" },
  "business-team": { variants: ['en-dark'] as AppMediaVariant[], caption: "business team", route: "_business_team" },
  "business-bulk": { variants: ['en-dark'] as AppMediaVariant[], caption: "business bulk", route: "_business_bulk_pay" },
  "business-approval": { variants: ['en-dark'] as AppMediaVariant[], caption: "business approval", route: "_business_invoices" },
  "business-payouts": { variants: ['en-dark'] as AppMediaVariant[], caption: "business payouts", route: "_business_invoices" },
  "business-keys": { variants: ['en-dark'] as AppMediaVariant[], caption: "business keys", route: "_business_api_keys" },
  "cards": { variants: ['en-dark'] as AppMediaVariant[], caption: "cards", route: "_cards" },
  "buy": { variants: ['en-dark'] as AppMediaVariant[], caption: "buy", route: "_buy" },
  "sell": { variants: ['en-dark'] as AppMediaVariant[], caption: "sell", route: "_sell" },
  "kyc": { variants: ['en-dark'] as AppMediaVariant[], caption: "kyc", route: "_kyc" },
  "recurring": { variants: ['en-dark'] as AppMediaVariant[], caption: "recurring", route: "_recurring" },
  "referrals": { variants: ['en-dark'] as AppMediaVariant[], caption: "referrals", route: "_referral" },
  "settings": { variants: ['en-dark'] as AppMediaVariant[], caption: "settings", route: "_settings" },
  "twofa": { variants: ['en-dark'] as AppMediaVariant[], caption: "twofa", route: "_settings_2fa" },
  "devices": { variants: ['en-dark'] as AppMediaVariant[], caption: "devices", route: "_settings_devices" },
  "history": { variants: ['en-dark'] as AppMediaVariant[], caption: "history", route: "_history" },
  "messages": { variants: ['en-dark'] as AppMediaVariant[], caption: "messages", route: "_messages_usr_omar" },
  "contact": { variants: ['en-dark'] as AppMediaVariant[], caption: "contact", route: "_contact_usr_omar" },
  "linked": { variants: ['en-dark'] as AppMediaVariant[], caption: "linked", route: "_linked_accounts" },
  "statements": { variants: ['en-dark'] as AppMediaVariant[], caption: "statements", route: "_statements" },
};
export const APP_VIDEOS: Record<string, { variants: AppMediaVariant[]; durationSec: number; caption: string }> = {};
export const screenSrc = (id: string, v: AppMediaVariant = 'en-dark') => `/app/screens/${v}/${id}.webp`;
export const videoSrc = (id: string, v: AppMediaVariant = 'en-dark') => ({ mp4: `/app/video/${v}/${id}.mp4`, webm: `/app/video/${v}/${id}.webm`, poster: `/app/video/${v}/${id}.jpg` });
export const APP_MEDIA_NOTES = ['Screens from the current app build. Names and amounts are illustrative.'];
