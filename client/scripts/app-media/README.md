# App marketing media

These scripts capture the current Expo web build with an invented account. All
app API calls and market data are intercepted by `fixtures.mjs`; no account or
database is needed. Unexpected API hosts are blocked. Native status-bar and
alert shims are presentation fixtures for the web build.

Start Expo on port 8081 from `mobile`, then install this harness's dependencies
in another terminal. No API server is required:

```sh
cd mobile && npx expo start --web --port 8081
```

```sh
npm install --prefix client/scripts/app-media
CHROME_BIN="/path/to/chromium" node client/scripts/app-media/capture.mjs en-dark,ar-dark,en-light home,messages,buy,asset,topup,cards
CHROME_BIN="/path/to/chromium" node client/scripts/app-media/capture.mjs en-dark,ar-dark,en-light send,chat-payment,remit,p2p,budgets,privacy-hidden,business-home,settings
node client/scripts/gen-app-media.mjs
node client/scripts/app-media/verify.mjs
node client/scripts/app-media/verify-confirm.mjs
```

The script requires `ffmpeg` and `ffprobe` on PATH. `APP_URL`, `CHROME_BIN`,
`PLAYWRIGHT_MODULE`, `FFMPEG`, and `FFPROBE` can override their default locations.
Use `CAPTURE_TEMP` to place QA files outside the project. Temporary source frames
are deleted after encoding; set `KEEP_CAPTURE_FRAMES=1` to retain them.

The source uses direct Chrome surface screenshots with explicit 2x device
metrics. The screencast protocol is avoided because it emits only CSS-sized
frames even on a retina device. Presentation timestamps preserve natural pauses
and gesture speed; the report records the actual source capture frame rate.
MP4 and WebM outputs run at 30 fps, retain smoothly eased app scrolling, and
include a short dissolve into the opening state. The fallback GIF keeps 20 fps;
its width is reduced for file size instead of dropping animation frames.
The accepted source recordings vary with screen complexity, approximately
12–30 captured frames per second; encoding at 30 fps preserves their timing.

The 14 refreshed screen loops cover the wallet home and activity, conversations,
buy quotes and fees, asset charts, supported P2P and cash top-up methods, card
activity, a completed send, chat payment and receipt, remittance quote and review,
P2P offers, budget detail, hidden balances, business bulk pay and approval review,
and trusted devices with two-factor controls. All have English dark, Arabic dark,
and English light variants. Other screen GIFs remain available as fallbacks.

Outputs are under `client/public/app/loops/<variant>/<id>.*` and
`client/public/app/gif/<variant>/<id>.gif`. Relevant loops also update the guided
tour clips under `client/public/app/video`. The capture report lists source
changed frames, source motion frame rate, encoded frame rate, and sizes. An
action failure or fewer than eight changed frames prevents publishing that loop.
