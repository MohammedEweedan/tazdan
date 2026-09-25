# tazdan mobile

Arabic-first crypto and everyday money for Libya and the wider Arab market.
The existing Expo Router screens, blue/charcoal identity, wallet ledger, trading,
P2P escrow, cards, chat, authentication and transfer APIs remain in place.
Fresh installs start in Arabic; existing saved language choices are preserved.
Arabic copy uses Cairo and right-to-left text; charts, addresses and numeric
entry retain their original geometry. English and the other languages remain available.
P2P highlights LYD and regional currencies; new listings start in LYD.
Balances retain their actual asset denomination and the user's display setting.

## Local development

```sh
# In server/ (requires its existing database and service configuration)
npm run dev
# In mobile/
npm start
```

Backend default: **5001**, avoiding macOS AirPlay's port 5000. The local server
`.env` must use the same PORT as `EXPO_PUBLIC_DEV_API_PORT` (default 5001).
Copy `.env.example` to `.env` only if no local env file exists, then restart Metro
after changes. Public Expo variables are bundled into the app; never put secrets there.

The shared endpoint resolver uses:

- Physical phone: the Metro machine's LAN IP, with `/api` and port 5001.
- Android emulator: `10.0.2.2:5001/api`.
- iOS simulator: Metro host or `localhost:5001/api`.
- Web development: the browser's hostname, so LAN previews work too.

For a tunnel, VPN or different machine set
`EXPO_PUBLIC_DEV_API_BASE=http://YOUR_LAN_IP:5001/api`. Expo's Metro tunnel
exposes Metro only, so the backend needs its own reachable address. The phone
and backend should share Wi-Fi, and the firewall must allow the API port.
Existing native debug configuration permits local HTTP; release API resolution
requires public HTTPS. Backend development CORS permits local origins and
native clients. Existing production origin restrictions remain in force.

## Standalone iPhone test build

Start the backend in `server/` with `npm run dev`, then connect the iPhone and
Mac to the same Wi-Fi. Unlock the phone, enable Developer Mode, and run from
`mobile/`:

```sh
npm run ios:local-test -- YOUR_DEVICE_ID
```

Find the device ID with `xcrun devicectl list devices`. The command builds a
signed Release app with JavaScript included, installs it, and launches it. It
does not need Expo Go or a running Metro server. The app talks to the Mac API
at `http://MAC_LAN_IP:5001/api`; that server talks to the configured database.
Allow Local Network access when iOS asks.
Hosted updates are disabled in this test app so it keeps the bundled Mac API
address.
The Mac must stay awake and reachable while using the app. If its LAN IP
changes, rebuild the app. Use `LOCAL_TEST_MAC_IP` or `LOCAL_TEST_INTERFACE`
when the active network is not `en0`.

The local test app uses bundle ID `com.tazdan.localtest` and a personal-team
signing profile. Its native Apple Pay, push notification, and Associated Domains
entitlements are omitted because personal teams cannot sign them. Production
builds retain their original identifier and entitlements. The local test API
override applies only when `EXPO_PUBLIC_LOCAL_TEST_BUILD=1` is set during the
build; other Release builds continue to require the production HTTPS API.
On first install, trust the developer profile in iPhone Settings → General →
VPN & Device Management. Personal-team profiles expire after seven days; run
the build command again to renew and reinstall.

## Deployed builds

`eas.json` preview and production profiles use
`EXPO_PUBLIC_PROD_API_BASE=https://api.promrkts.com`. Release bundles ignore
all `EXPO_PUBLIC_DEV_*` values and Metro discovery. The existing hosted reverse
proxy serves API routes at the root; local Express uses `/api`. HTTP and sockets
share the same resolved environment. Auth/token refresh and API contracts are unchanged.

For a different hosted backend, set `EXPO_PUBLIC_PROD_API_BASE` to its public
HTTPS base. Custom hosts receive `/api` if omitted. The legacy
`EXPO_PUBLIC_API_BASE` override remains supported, but a local/HTTP legacy value
without a dedicated PROD override is rejected in release builds.
Use a release export/build (`eas build --profile production`); Expo dev mode
intentionally connects locally. Native rebuilds are needed after native config changes.

## Verification

```sh
npm run typecheck
npm run test:api-config
npm run i18n:audit
```

Supported assets and transfer corridors still depend on existing backend,
provider and account eligibility. This UI update does not create new payment
rails, change custody, or establish regulatory approval.
