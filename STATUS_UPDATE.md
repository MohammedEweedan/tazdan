# Promrkts Implementation Status

Updated: 2026-06-08

This summarizes the work completed in this chat. It focuses on the mobile trading flows, the asset/currency detail page, top-up, backend discussions, and the landing hero redesign.

## Completed

### Shared Mobile UI Primitives

- Added/updated reusable amount, keypad, and picker UI:
  - `mobile/src/components/ui/AmountDisplay.tsx`
  - `mobile/src/components/ui/NumericKeypad.tsx`
  - `mobile/src/components/ui/CurrencyPicker.tsx`
- `CurrencyPicker` now supports fiat, crypto, and card-style entries.
- Fiat currencies show currency symbols instead of flags.
- Picker icons respect theme color: dark mode uses light glyphs, light mode uses dark glyphs.
- Crypto icons avoid colored background pills while retaining icon color.
- Numeric keypad supports fixed responsive key heights and font sizes.
- Amount display supports a max font size so buy/sell/send/top-up can share the same visual language.

### Buy Widget

- Updated `mobile/src/components/exchange/BuyWidget.tsx`.
- Removed the separate card icon/button row.
- Card buying is now represented inside the currency/payment picker rather than consuming its own row.
- Apple Pay appears above `SlideToConfirm`.
- Added responsive sizing so keypad and amount display fit better on smaller screens.
- Amount typography matches the newer trading design language.
- Currency/payment display uses symbols rather than flags.

### Sell Widget

- Updated `mobile/src/components/exchange/SellWidget.tsx`.
- Fixed the tiny sell amount font by matching the Buy widget’s `AmountDisplay` sizing.
- Moved the receive currency picker above the amount entry to align with Buy.
- Updated currency symbols/glyph colors to match the shared picker design.
- Added responsive keypad and amount sizing.

### Send Widget / Send Page

- Updated `mobile/src/components/exchange/SendWidget.tsx`.
- Replaced the old “Preview Send” button with `SlideToConfirm`.
- Moved the send action to the bottom flow.
- Changed “Add note” into a plus button that expands inline.
- Note input now collapses/removes without forcing extra scrolling.
- Added responsive keypad and amount sizing.

### Buy / Sell / Send Routes

- Updated:
  - `mobile/app/buy.tsx`
  - `mobile/app/sell.tsx`
  - `mobile/app/send.tsx`
- Routes now render the shared widgets directly as full-screen flows instead of duplicating older widget/page logic.

### Home Modal / Routing Updates

- Updated `mobile/app/(tabs)/index.tsx`.
- Buy/Sell/Send modals now use fixed-height full-screen-style wrappers instead of scroll wrappers.
- Home “Top up” now routes to `/topup` instead of opening the old top-up bottom sheet.
- Removed the home-level `TopupSheet` usage.

### Top-Up Page

- Updated:
  - `mobile/app/topup.tsx`
  - `mobile/src/components/topup/TopupSheet.tsx`
- Top-up now behaves like a full-screen page, not a clipped widget.
- Added full-screen top bar with an `X` close action.
- Removed the old `ScreenShell` header/back arrow from the top-up route.
- Removed quick amount chips.
- Top-up body owns its scroll behavior and uses keypad + `SlideToConfirm`.
- Top-up still supports method selection, currency selection, amount entry, fee/method details, step-up warning, and submission flow.

### Asset / Currency Detail Page

- Heavily redesigned `mobile/app/asset/[currency].tsx`.
- Replaced the old top `Overview / News` split with a screenshot-style market detail layout:
  - Centered asset title and price.
  - Price change row.
  - Large chart area.
  - Timeframe selector.
  - Asset icon/name/holdings row.
  - Buy/sell position strip.
  - One-line stats strip for market cap, volume, supply, and all-time high.
  - Bottom tabs for Activity, News, and Discussions.
- Preserved both chart modes:
  - Sparkline/line chart.
  - Candlestick chart.
- Moved line/candle toggle into the top-right header area where the star icon used to be.
- Removed the live badge.
- Removed the star icon.
- Added QR/deposit button in the header.
- Deposit address now renders as a modal with QR code and copy action instead of an inline activity card.
- Activity tab now shows an empty state instead of disappearing when there are no transactions.
- Buy button remains on the right and Sell remains on the left.

### Chart Behavior

- Removed internal chart grid lines.
- Removed padded/card chart wrapper.
- Made charts render edge-to-edge/full-bleed in the asset page UI.
- Sparkline tracking stays pinned to the line.
- Candlestick tracking now highlights the exact hovered candle.
- Hovered candle glows green for green candles and red for red candles.
- Buy/sell execution markers remain supported.

### Backend Discussions

- Added persistent backend support for public asset discussions.
- Added Prisma model:
  - `AssetDiscussionPost`
  - `AssetDiscussionTag`
- Added migration:
  - `server/prisma/migrations/20260607143000_add_asset_discussions/migration.sql`
- Added controller:
  - `server/src/controllers/assetDiscussion.controller.ts`
- Added route:
  - `server/src/routes/assetDiscussion.ts`
- Mounted route in:
  - `server/src/index.ts`
- API endpoints:
  - `GET /api/asset-discussions/:symbol`
  - `POST /api/asset-discussions/:symbol`
- Discussions are authenticated and store user, symbol, body, tag, and timestamps.

### Mobile Discussions UI

- Asset discussion tab now calls the backend API.
- Added composer with Bullish / Watch / Bearish tags.
- Posts show author display name, tag, body, and relative time.
- Added loading, error, and empty states.

### Landing Page / Hero Mockups

- Updated `client/src/app/page.tsx`.
- Replaced the outdated token-search hero chapter with a redesigned asset-detail mock matching the new mobile currency page.
- New hero asset screen includes:
  - Centered price.
  - Full-bleed chart.
  - Line/candle toggle treatment.
  - Icon + holdings row.
  - One-line market stats.
  - Activity / News / Discussions tabs.
  - Sell left, Buy right action buttons.
- Removed stale quick-amount chips from the buy hero mock so it better matches the current UI direction.

## Verified

The following checks passed:

```bash
cd mobile && npm run typecheck -- --pretty false
cd server && npm run build
cd client && npm run build
```

Earlier mobile typechecks also passed after the Buy/Sell/Send/Top-up changes.

## Still Not Implemented / Remaining Gaps

- The new Prisma migration still needs to be applied to the actual database.
- Asset discussions now persist, but moderation/report/delete/admin review UI is not implemented.
- Discussions do not yet have realtime socket updates.
- True 52-week range and average volume are still not available in the current market hook; the asset page uses available real fields instead.
- No Playwright/device screenshot verification was run for the React Native screens in this chat.
- Expo lint did not complete earlier because the project tried to auto-install missing ESLint packages while network access was blocked. The accidental lint dependency edit was removed.

## Important Notes

- The worktree already had many unrelated dirty files before and during this chat. I did not revert unrelated user/other-agent changes.
- The status above covers the intentional implementation work completed in this chat.
