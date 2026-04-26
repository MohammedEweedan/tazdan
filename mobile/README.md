# Promrkts — Mobile (Expo)

Premium fintech mobile client. Crypto + fiat wallets, P2P, send/receive,
on/off-ramp, virtual cards.

## Stack

- **Expo SDK 54** + React Native 0.81 + React 19 + TypeScript (strict)
- **New Architecture enabled** (Fabric / TurboModules) — default on SDK 54
- **Expo Router 6** (typed routes)
- **NativeWind v4** (Tailwind for RN)
- **Reanimated 4** + `react-native-worklets` plugin + **Moti** for animations
- **Zustand 5** for client state, **TanStack Query 5** for server state
- **Axios** for HTTP, **expo-secure-store** for tokens (with web fallback)
- **React Hook Form** + **Zod** for forms

## Install

```bash
cd mobile
npm install

# iOS simulator
npm run ios

# Android emulator
npm run android

# Expo Go (scan QR with phone)
npm start
```

> **Note**: dependency versions are pinned to what `expo doctor` expects for
> SDK 54. To upgrade individual packages, always use `npx expo install <pkg>`
> so Expo's compatibility matrix is respected. Bumping `react-native` or
> `react-native-reanimated` independently will break worklet compilation.

> **Reanimated 4 migration note**: the babel plugin moved from
> `react-native-reanimated/plugin` → `react-native-worklets/plugin` (already
> applied in `babel.config.js`). If you upgrade from SDK 51, also delete
> `node_modules/.cache` and `.expo/` before the first run.

## Environment

Create `mobile/.env` (or use a hosted env):

```bash
EXPO_PUBLIC_API_BASE=http://localhost:5000/api
EXPO_PUBLIC_USE_MOCK=true   # false → call real backend
```

When `USE_MOCK=true` (default), every service in `src/services/index.ts` returns
deterministic data from `src/data/fakeData.ts`. Set to `false` to hit the
backend at `EXPO_PUBLIC_API_BASE`.

## Project layout

```
mobile/
├─ app/                            # Expo Router file routes
│  ├─ _layout.tsx                  # root: providers, auth gate, splash → tabs
│  ├─ index.tsx                    # boot/splash screen
│  ├─ (auth)/                      # unauthenticated routes
│  │  ├─ _layout.tsx
│  │  ├─ onboarding.tsx            ✅ HERO
│  │  ├─ login.tsx                 ✅ HERO
│  │  ├─ register.tsx              · stub
│  │  └─ kyc.tsx                   · stub
│  ├─ (tabs)/                      # main tab nav (after login)
│  │  ├─ _layout.tsx               # 4 tabs · BlurView bar
│  │  ├─ index.tsx                 ✅ HERO — dashboard
│  │  ├─ wallet.tsx                ✅ HERO — wallet detail
│  │  ├─ p2p.tsx                   · stub
│  │  └─ profile.tsx               ✅ full
│  ├─ buy.tsx · sell.tsx · send.tsx · receive.tsx · transfer.tsx
│  ├─ topup.tsx · cards.tsx · history.tsx · settings.tsx
│  ├─ notifications.tsx · referral.tsx
│  └─ chat/[id].tsx                # P2P trade chat
└─ src/
   ├─ theme/index.ts               # design tokens (colors, gradients, shadows)
   ├─ types/index.ts               # domain types (mirrors Prisma schema)
   ├─ constants/index.ts           # app config + currency metadata
   ├─ utils/format.ts              # money / time formatters
   ├─ data/fakeData.ts             # demo seed data (used when USE_MOCK=true)
   ├─ lib/
   │  ├─ api.ts                    # axios + auth interceptors + auto-refresh
   │  ├─ secureStore.ts            # expo-secure-store with web fallback
   │  └─ queryClient.ts            # React Query config
   ├─ services/index.ts            # API service layer (mock-aware)
   ├─ store/
   │  ├─ authStore.ts              # zustand: user, login/logout, hydrate
   │  └─ uiStore.ts                # zustand: ephemeral UI state
   ├─ hooks/
   │  ├─ useHaptics.ts             # iOS/Android haptics with web noop
   │  └─ index.ts                  # query hooks (wallets, txns, markets…)
   └─ components/
      ├─ ui/
      │  ├─ Button.tsx             # primary / secondary / ghost
      │  ├─ Card.tsx               # glass + solid variants
      │  ├─ Input.tsx              # floating label
      │  ├─ Avatar.tsx             # gradient initial fallback
      │  ├─ AnimatedNumber.tsx     # ticking counter
      │  ├─ Skeleton.tsx
      │  ├─ Sparkline.tsx          # SVG mini-chart
      │  ├─ GradientBackground.tsx # app background w/ glows
      │  ├─ ScreenHeader.tsx
      │  └─ ScreenStub.tsx         # consistent placeholder for unbuilt routes
      ├─ wallet/
      │  ├─ WalletCard.tsx         # premium gradient card
      │  └─ QuickActions.tsx       # Send/Receive/Buy/Topup row
      ├─ transactions/
      │  └─ TransactionItem.tsx
      └─ markets/
         └─ MarketRow.tsx
```

## Hero screens delivered

1. **Splash** (`app/index.tsx`) — animated wordmark with pulsing brand orb.
2. **Onboarding** (`app/(auth)/onboarding.tsx`) — 3-page paged carousel with
   per-slide reveal animations and animated progress dots.
3. **Login** (`app/(auth)/login.tsx`) — RHF + Zod validated form, floating-label
   inputs, password reveal, Apple SSO placeholder, Moti entrance.
4. **Home Dashboard** (`app/(tabs)/index.tsx`) — animated total balance, 24h
   change pill, quick actions, paged wallet cards slider with sparklines, live
   markets list, recent activity feed.
5. **Wallet Detail** (`app/(tabs)/wallet.tsx`) — net-worth hero, segmented
   ALL/CRYPTO/FIAT control, animated wallet rows with sparklines + USD value
   + 24h %.
6. **Profile** (`app/(tabs)/profile.tsx`) — user header + KYC tier badge,
   grouped settings rows, logout.
7. **Send Money** (`app/send.tsx`) — 3-step flow: recipient picker →
   numeric keypad with shake-on-overspend → confirm preview with note.
8. **Buy Crypto** (`app/buy.tsx`) — coin chips, live spot card with
   sparkline, fiat input, fee breakdown, payment method picker.
9. **P2P Marketplace** (`app/(tabs)/p2p.tsx`) — BUY/SELL segmented control,
   fiat filter chips, animated offer cards with trader rating, limits, methods.
10. **Cards** (`app/cards.tsx`) — paged virtual Visa cards (5 colorways),
    spend stats with progress bar, control grid (freeze/topup/settings/cancel),
    recent card transactions.
11. **Receive** (`app/receive.tsx`) — Handle / Crypto / Bank tabs, in-app
    pseudo-QR generator, network picker (TRC20/ERC20/BEP20), copy + share.
12. **Sell crypto** (`app/sell.tsx`) — Buy mirror in rose-red palette: coin
    chips, live spot card, MAX-fillable amount, payout method picker.
13. **Top up** (`app/topup.tsx`) — large amount input, fiat picker, quick
    chips, Apple-Pay-style CTA, saved cards list.
14. **Settings** (`app/settings.tsx`) — grouped rows with iOS-style toggles
    for biometrics / 2FA / push / marketing, navigation rows, danger zone.
15. **Notifications** (`app/notifications.tsx`) — All / Activity / Security /
    Promo tabs, unread dot + tinted icons, "Mark all read" header action.
16. **Register** (`app/(auth)/register.tsx`) — 3-step flow with progress bar:
    name+email+password → phone+country → @handle picker with live availability.
17. **Convert** (`app/transfer.tsx`) — wallet ↔ wallet swap with from/to
    currency tabs, mid-arrow swap button, live exchange rate display.
18. **Refer & earn** (`app/referral.tsx`) — gradient hero, code box with
    copy, share CTA, earnings/pending/joined stats, 3-step "how it works".

The remaining 3 routes use a consistent `ScreenStub` placeholder so
navigation flows work end-to-end during dev:
- `app/(auth)/kyc.tsx` (Sumsub SDK integration)
- `app/history.tsx` (works as a basic list — needs filters/search/grouping)
- `app/chat/[id].tsx` (real-time messaging via socket.io)

## Auth flow

- App boots → `app/_layout.tsx::AuthGate` calls `useAuthStore.hydrate()`.
- Hydrate reads access token from SecureStore. If valid, fetches `/auth/me`.
- `AuthGate` redirects: unauthenticated → `(auth)/onboarding`, authenticated → `(tabs)`.
- Axios interceptor at `src/lib/api.ts` rotates the refresh token on 401.
  If the rotation fails, tokens are wiped and the auth store force-logs-out.

## Backend integration

The mobile app and backend share the same domain types — see `mobile/src/types/index.ts`
vs `server/prisma/schema.prisma`. When wiring real endpoints:

1. In `src/services/index.ts`, every service routes through `USE_MOCK`. Set
   `EXPO_PUBLIC_USE_MOCK=false` to flip to real Axios calls.
2. The endpoint shapes already match what the server's controllers return —
   `authService.login()` calls `POST /api/auth/login` and expects
   `{ user, accessToken, refreshToken }`, which is exactly what the existing
   `AuthController.login` returns.
3. Refresh-token rotation is already wired (see `src/lib/api.ts` — calls
   `POST /api/auth/refresh` with the persisted refresh token).
4. SecureStore keys live in `src/constants/index.ts::STORAGE_KEYS`.

## Theming

All colors / gradients / shadows are defined once in `src/theme/index.ts` and
mirrored in `tailwind.config.js`. Use Tailwind classes for layout (`bg-brand-600`,
`text-ink-primary`) and the theme constants for non-Tailwind contexts
(LinearGradient `colors`, RN `shadow*` props).

Brand palette:
- Brand mid: `#4A8FE0` (`brand-400`)
- Brand deep: `#0057B8` (`brand-600`)
- Surface base: `#030818`
- Surface card: `rgba(255,255,255,0.04)`

## Roadmap (next sessions)

1. **Send Money** — full keypad UI, recipient resolver, preview/confirm flow
2. **Buy Crypto** — currency picker, fiat input, payment-method sheet, quote → confirm
3. **P2P Marketplace** — offer list with filters, trader detail, escrow flow
4. **Chat** — full RealTime via socket.io
5. **Cards** — virtual card UI matching the web's card mock
6. **KYC** — Sumsub SDK integration
7. **Web dashboard mirror** — re-implement authenticated pages in
   `client/` to match this mobile UI 1:1.

## Troubleshooting

- **Red screen on boot**: usually means `babel-preset-expo` or NativeWind isn't
  picked up. Run `npx expo start -c` to clear the Metro cache.
- **TypeScript red squiggles after install**: the IDE's TS server caches the
  pre-install state. Run "TypeScript: Restart TS Server" in VS Code/Cursor.
- **Reanimated worklet errors**: ensure `react-native-reanimated/plugin` is the
  LAST entry in `babel.config.js` plugins array.
