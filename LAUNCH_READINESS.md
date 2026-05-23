# Fortuni — Launch Readiness Analysis

**Date:** 2026-05-23
**Branch reviewed:** `master`
**Scope:** mobile app + supporting server pieces required to ship to App Store + Play Store

This is an honest, prioritised list of what's between "today" and a public launch. It's grouped into:

1. **Hard blockers** — you cannot launch without these.
2. **Risk reducers** — you *can* launch without them, but you shouldn't.
3. **Polish** — nice-to-haves that lift perceived quality.

---

## 1. Hard blockers

### 1.1 Payments are still on the MOCK on-ramp provider

- `server/src/services/onramp/index.ts` defaults to `MockOnRampProvider` unless `ONRAMP_PROVIDER=STRIPE`.
- The Stripe code path exists (`stripe.provider.ts`) and is wired through `gatewayQuote` / `gatewayConfirm` / `webhookStripe`.
- **Action:**
  - Set `ONRAMP_PROVIDER=STRIPE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in production.
  - Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` + `EXPO_PUBLIC_APPLE_MERCHANT_ID` in the mobile EAS build profile.
  - Register the webhook URL `https://api.fortuni.app/api/deposits/webhook/stripe` in the Stripe dashboard. Test with Stripe CLI.

### 1.2 Apple Pay / Google Pay native install + Apple merchant cert

The mobile-side scaffolding I just added (`@stripe/stripe-react-native`, `ExpressPayButton`, `StripeProvider`, entitlements in `app.json`) won't run until you:

- `cd mobile && npx expo install @stripe/stripe-react-native` (the package is already in `package.json` but `node_modules` hasn't been refreshed).
- Run a fresh native build via EAS (`eas build -p ios` + `eas build -p android`) — the Stripe plugin needs to apply at prebuild time.
- In Apple Developer portal, create the merchant ID `merchant.com.fortuni.app` (or whatever you change `EXPO_PUBLIC_APPLE_MERCHANT_ID` to), then generate an Apple Pay payment-processing certificate using the CSR Stripe provides. Wire the cert in Stripe → Settings → Payments → Apple Pay.
- For Google Pay, configure the **Google Pay & Wallet Console** merchant profile (Stripe handles the rest).

### 1.3 KYC / AML provider is not wired

- `server/src/__tests__/aml.test.ts` exists but the live integration (Sumsub / Onfido / Persona / Trulioo) is not in the code.
- App stores will reject a financial app that accepts deposits with no identity verification.
- **Action:** pick a vendor, integrate at registration + before first withdrawal. Easiest: Sumsub WebSDK in an in-app browser.

### 1.4 Legal documents

- Privacy policy, Terms of Service, AML/KYC policy, transfer agreement — required for both App Store + Play Store + Stripe onboarding.
- Need to be hosted at stable URLs (e.g. `https://fortuni.app/privacy`) and linked from inside the app (Profile → Legal).
- Crypto disclosures are jurisdiction-specific (US: SEC/MSB language; EU: MiCA; UK: FCA). Have a fintech lawyer review.

### 1.5 Production server hardening

Check before flipping the prod switch:
- All `JWT_SECRET` / `JWT_REFRESH_SECRET` values rotated + ≠ between staging and prod.
- `NODE_ENV=production`, `CORS_ORIGIN` locked to your real domain (not `*`).
- Database is Postgres in prod (not the dev sqlite, if you're on that).
- Webhook endpoints rate-limited and behind a HEAD-/POST-only allow-list.
- TLS terminates at the LB (nginx is already in `docker-compose.prod.yml` — confirm cert auto-renew via Certbot/ACME).
- All `Authorization: Basic` Stripe calls go out over TLS only.
- Backups: automated daily Postgres `pg_dump` → S3 (or equivalent) + tested restore.

### 1.6 Store listings + privacy manifests

- App Store: privacy "nutrition label" form requires you to declare every category of data you collect. Map this from the User/Wallet/Transaction models.
- iOS 17+ requires `PrivacyInfo.xcprivacy` for any third-party SDK with a tracking domain. Stripe, Sentry, Expo, etc. — add their manifests via their config plugins.
- Play Store: data safety form same idea, plus you need a 24h-resolvable contact email for crypto apps.
- Both stores require crypto exchange apps to publish licensing/registration info. If you're operating from the UAE that means VARA in Dubai; from Egypt CMA; US is per-state MSB. Without this, listings get pulled within weeks of publication.

---

## 2. Risk reducers (ship without at your peril)

### 2.1 Observability

- Sentry DSN is declared in mobile `.env` but no `Sentry.init()` call exists in `_layout.tsx`. Wire it. Same for the server (`@sentry/node`).
- Add basic structured logging (`pino`) on the server with request IDs so you can correlate webhooks ↔ user actions.
- A `/healthz` + `/readyz` endpoint for the LB to probe.

### 2.2 Crypto custody

The repo references on-chain webhook handlers (`webhookAlchemy`, `webhookTrongrid`) and a `cryptoWallet` route, but production custody is high-stakes:
- Hot-wallet keys should be in a KMS (AWS KMS / GCP KMS / HSM), never in env vars.
- Withdrawals should require a 2-of-N approval flow even for the admin (you'll regret a single-key setup the first time someone's session token leaks).
- Consider Fireblocks / BitGo / Cobo for custody-as-a-service; you can ship faster and offload the audit burden.

### 2.3 P2P trading

`p2p.ts` route + `p2p.tsx` screen exist, but P2P brings additional regulatory risk (you're a marketplace for crypto-fiat trades). Confirm with legal whether to ship P2P on day 1 or hide it behind a feature flag until the licensing is sorted.

### 2.4 Push notifications

- `expo-notifications` is wired but I don't see a confirmed APNs/FCM credential setup in EAS. Without it the topup/quote/deposit notifications you trigger from the server will silently no-op.
- Run `eas credentials` to verify both platforms have valid keys.

### 2.5 Rate limiting + abuse controls

- Spam-register a hundred accounts then try to fetch quotes — currently nothing rate-limits the `/exchange/quote` or `/auth/register` endpoints based on what I see. Add `express-rate-limit` at minimum, and a per-IP CAPTCHA on register/login.

### 2.6 Accessibility

- The new SlideToConfirm relies on swipe gesture — add a long-press fallback for users who can't drag (motor accessibility) AND an `accessibilityActions={[{ name: 'activate' }]}` mapping.
- Text contrast: the periwinkle-on-charcoal accent in dark mode is AA-passing for body text but borderline for the 11px section labels (`YOU PAY`, etc.). Audit with a contrast checker.
- Add `accessibilityLabel` to icon-only Pressables (theme toggle, language switcher, intent toggle).

### 2.7 i18n completeness

- `LOCALE_META` advertises 4 locales. Confirm every string in onboarding, signup, KYC, error toasts, and store listing is actually translated. Missing translations fall back to keys, which look ugly.
- RTL: confirm the BuyWidget / SellWidget asset selector chevron flips in Arabic mode.

### 2.8 Crypto network fees

`BuyWidget` includes a `networkFee` in the quote response — confirm the server actually computes a *live* gas estimate per network (ETH ↔ TRC20 fees diverge by orders of magnitude). A stale fee here = direct revenue leak when ETH spikes.

---

## 3. Polish (after blockers + risk reducers)

### 3.1 Buy/Sell widget — small UX wins still on the table

- The instant price estimate (`priceEstimate`) is good but it's only shown above the input now — also show it inside the quote panel so the user has a single source of truth.
- The Pay-with row shows raw `card / fiat / crypto` types; consider grouping (Cards section, Wallets section).
- For "Send to address", auto-validate the address against the asset's regex (e.g. BTC `^bc1|^[13]`, ETH `^0x[a-fA-F0-9]{40}$`) before allowing slide-to-confirm.

### 3.2 Onboarding

- The new animated hero is pure Reanimated and runs on the UI thread, but consider gating animations behind `AccessibilityInfo.isReduceMotionEnabled()` for users who've disabled motion.
- The third "permissions" slide silently calls Camera + biometrics + notifications APIs — wrap each in an inline "Allow X" tile so the user understands what just happened, instead of three OS dialogs in sequence.

### 3.3 Tab bar

- Now uses brand-gradient FAB and brand-tinted active state. Test on small devices (iPhone SE) — the 62-px FAB with 3-px border + halo shadow can look cramped.
- The home tab's long-press → action sheet feature is undiscoverable; add a 1-time tooltip the first time the user lands on home.

### 3.4 SlideToConfirm

- The new shimmer + brand gradient looks great but is slightly more battery than the old design (constant repeat animations). Acceptable; just be aware. If you see complaints, gate the shimmer with `Platform.isLowPowerMode` (need a small native module — skip unless reported).

### 3.5 Theme

- The light mode is genuinely usable but the brand `#226dff` periwinkle accent dominates the page when used heavily (quick-amount chips, intent toggle). Consider toning it to `brand.softLight` (`#dde7ff`) for "selected but secondary" states and reserving full periwinkle for primary CTAs only.

---

## 4. Concrete next 7 days

1. **Day 1:** Run `npx expo install @stripe/stripe-react-native`, rebuild with EAS dev client, smoke-test the ExpressPay button against Stripe test keys. Confirm Apple Pay sheet appears in iOS simulator on real device.
2. **Day 2:** Wire Sumsub (or chosen KYC vendor). Add a `kycStatus` gate in front of withdrawals + first deposit > $X.
3. **Day 3:** Privacy policy, ToS, AML policy drafted with a lawyer. Hosted under `fortuni.app/legal/*`. Linked from Profile screen.
4. **Day 4:** Sentry on both client + server. Pino structured logging. Basic Grafana dashboard for webhook success rate + p95 latency.
5. **Day 5:** Apple Pay merchant cert generated + uploaded to Stripe. Real Stripe live keys provisioned. End-to-end production webhook test (small amount, real card).
6. **Day 6:** App Store + Play Store metadata, screenshots (use the new animated onboarding), privacy nutrition labels, crypto licensing affidavit attached.
7. **Day 7:** Internal TestFlight + closed Play track. Hand the build to ~10 friendlies. Crash-watch via Sentry for 48h before promoting.

---

## 5. Out of scope for this session (worth tracking)

These came up while reviewing the codebase but weren't part of the brief:

- `ALGO` and `NEAR` `KNOWN[]` entries in `SellWidget.tsx` have `color: '#000000'` which renders invisible on a dark surface — fix.
- `BuyWidget.tsx` line 99 fixes a regex but the `serverAsset()` / `defaultNetwork()` maps are duplicated across Buy + Sell. Consolidate into a single `cryptoMeta.ts` module.
- `tabs/_layout.tsx` long-press handler shows `t('home.more')` but doesn't actually trigger any of the listed actions on Android (only iOS gets the ActionSheet). Fix or remove the long-press promise.
- `themeStore.ts` documentation says "warm charcoal" but the dark `bg` is `#141518` — a *cold* charcoal. Tiny copy nit but worth fixing the comment so future contributors don't get confused.

---

**Bottom line:** the architecture is solid. The remaining work is integration + compliance, not engineering. Stripe pieces (server + mobile) are largely done; you mostly need keys, certs, and a KYC vendor. Plan ~3–4 weeks calendar time from today to a credible public launch with the blockers in §1 closed.
