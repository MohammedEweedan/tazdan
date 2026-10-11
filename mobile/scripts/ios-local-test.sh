#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d ios/tazdan.xcworkspace ]]; then
  npx expo prebuild --platform ios
fi

device_id="${1:-}"
build_destination='generic/platform=iOS'
if [[ -n "$device_id" ]]; then
  device_udid="$(xcrun devicectl device info details --device "$device_id" | sed -n 's/.*udid: //p' | head -1)"
  if [[ -z "$device_udid" ]]; then
    echo "Could not resolve the iPhone UDID from $device_id." >&2
    exit 1
  fi
  build_destination="platform=iOS,id=$device_udid"
fi
mac_ip="${LOCAL_TEST_MAC_IP:-$(ipconfig getifaddr "${LOCAL_TEST_INTERFACE:-en0}")}"
api_port="${LOCAL_TEST_API_PORT:-5001}"

if [[ -z "$mac_ip" ]]; then
  echo "Could not find the Mac LAN address. Set LOCAL_TEST_MAC_IP and retry." >&2
  exit 1
fi
if [[ ! "$api_port" =~ ^[0-9]+$ ]]; then
  echo "LOCAL_TEST_API_PORT must be a number." >&2
  exit 1
fi

export EXPO_PUBLIC_LOCAL_TEST_BUILD=1
export EXPO_PUBLIC_LOCAL_TEST_API_BASE="http://$mac_ip:$api_port/api"
export EXPO_NO_TELEMETRY=1
export SENTRY_DISABLE_AUTO_UPLOAD=true
export SENTRY_COLLECT_MODULES=disabled

if ! curl --fail --silent --show-error --max-time 5 "$EXPO_PUBLIC_LOCAL_TEST_API_BASE/features" >/dev/null; then
  echo "Start the Mac API server and check $EXPO_PUBLIC_LOCAL_TEST_API_BASE before building." >&2
  exit 1
fi

output_dir="$PWD/build/local-ios-test"
app_path="$output_dir/DerivedData/Build/Products/Release-iphoneos/tazdan.app"
mkdir -p "$output_dir"
cat > "$output_dir/LocalTest.entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
PLIST

# Keep the local build on its bundled JS; a hosted update could point it back
# at the production API. Restore the native project after building.
expo_plist="$PWD/ios/tazdan/Supporting/Expo.plist"
expo_plist_backup="$(mktemp "$output_dir/Expo.plist.XXXXXX")"
info_plist="$PWD/ios/tazdan/Info.plist"
info_plist_backup="$(mktemp "$output_dir/Info.plist.XXXXXX")"
cp "$expo_plist" "$expo_plist_backup"
cp "$info_plist" "$info_plist_backup"
restore_native_plists() {
  cp "$expo_plist_backup" "$expo_plist"
  cp "$info_plist_backup" "$info_plist"
  rm "$expo_plist_backup" "$info_plist_backup"
}
trap restore_native_plists EXIT
/usr/libexec/PlistBuddy -c 'Set :EXUpdatesEnabled false' "$expo_plist"
/usr/libexec/PlistBuddy -c 'Set :NSLocalNetworkUsageDescription tazdan connects to the development server on your Mac for local testing.' "$info_plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c 'Add :NSLocalNetworkUsageDescription string tazdan connects to the development server on your Mac for local testing.' "$info_plist"
if ! /usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity' "$info_plist" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c 'Add :NSAppTransportSecurity dict' "$info_plist"
fi
/usr/libexec/PlistBuddy -c 'Set :NSAppTransportSecurity:NSAllowsLocalNetworking true' "$info_plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c 'Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true' "$info_plist"

echo "Building local iOS test app for $EXPO_PUBLIC_LOCAL_TEST_API_BASE"
if ! xcodebuild \
  -workspace ios/tazdan.xcworkspace \
  -scheme tazdan \
  -configuration Release \
  -sdk iphoneos \
  -destination "$build_destination" \
  -derivedDataPath "$output_dir/DerivedData" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  PRODUCT_BUNDLE_IDENTIFIER=com.tazdan.localtest \
  CODE_SIGN_ENTITLEMENTS="$output_dir/LocalTest.entitlements" \
  build > "$output_dir/build.log" 2>&1; then
  tail -80 "$output_dir/build.log" >&2
  exit 1
fi

echo "Built $app_path"
if [[ -n "$device_id" ]]; then
  xcrun devicectl device install app --device "$device_id" "$app_path"
  if ! xcrun devicectl device process launch --device "$device_id" com.tazdan.localtest; then
    echo "If iOS blocked this newly signed app, trust the developer in Settings > General > VPN & Device Management, then open tazdan." >&2
    exit 1
  fi
fi
