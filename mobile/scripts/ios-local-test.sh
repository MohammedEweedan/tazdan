#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Personal-team signing: LOCAL_TEST_TEAM_ID, or the team of the first Apple
# Development certificate in the keychain.
team_id="${LOCAL_TEST_TEAM_ID:-$(security find-certificate -a -c 'Apple Development' -p 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | sed -n 's/.*OU=\([A-Z0-9]*\).*/\1/p' | head -1)}"
if [[ -z "$team_id" ]]; then
  echo "No Apple Development certificate found. Sign in to Xcode with your Apple ID, or set LOCAL_TEST_TEAM_ID." >&2
  exit 1
fi
export LOCAL_TEST_TEAM_ID="$team_id"

device_id="${1:-}"
build_destination='generic/platform=iOS'
if [[ -n "$device_id" ]]; then
  device_info="$(xcrun devicectl device info details --device "$device_id" 2>&1 || true)"
  # Xcode 27 prints "• UDID: …"; older versions print "udid: …".
  device_udid="$(printf '%s\n' "$device_info" | sed -n 's/.*[Uu][Dd][Ii][Dd]: *//p' | head -1 | tr -d '[:space:]')"
  if [[ -z "$device_udid" ]]; then
    echo "Could not resolve the iPhone UDID from $device_id. Is the phone connected and paired? (xcrun devicectl list devices)" >&2
    exit 1
  fi
  if printf '%s\n' "$device_info" | grep -qi 'Developer Mode Status: Disabled'; then
    echo "Developer Mode is off on the iPhone. Turn it on in Settings > Privacy & Security > Developer Mode, let the phone restart, confirm 'Turn On', then run this again." >&2
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

# Generate the native project for the local test variant (app.config.js):
# com.tazdan.localtest, its widget extension com.tazdan.localtest.widgets and
# App Group group.com.tazdan.localtest — never the production identifiers.
# Reuse only a project that already has the widget bridge's minimum iOS
# version. Older 15.1 projects silently exclude the ExtensionStorage pod.
# Set LOCAL_TEST_REGENERATE=1 after other native config changes.
if [[ "${LOCAL_TEST_REGENERATE:-0}" != "1" && -f ios/.tazdan-local-test-prebuild-complete ]] && grep -q 'com.tazdan.localtest.widgets' ios/tazdan.xcodeproj/project.pbxproj 2>/dev/null && \
  node -e 'const p = require("./ios/Podfile.properties.json"); process.exit(parseFloat(p["ios.deploymentTarget"] || "0") >= 16.4 ? 0 : 1)' 2>/dev/null; then
  echo "Reusing the local test iOS project (LOCAL_TEST_REGENERATE=1 to rebuild it)"
else
echo "Generating the local test iOS project (team $team_id)"
TAZDAN_LOCAL_TEST=1 npx expo prebuild --platform ios --clean --no-install > "$output_dir/prebuild.log" 2>&1 || { tail -40 "$output_dir/prebuild.log" >&2; exit 1; }
# Xcode 27 refuses pod targets below iOS 15 (several resource bundles still
# declare 9–13). Raise only those, after React Native's own post-install.
if ! grep -q 'tazdan: minimum pod deployment target' ios/Podfile; then
  /usr/bin/perl -0pi -e 's/(post_install do \|installer\|\n)/$1    # tazdan: minimum pod deployment target\n    installer.pods_project.targets.each do |t|\n      t.build_configurations.each do |c|\n        c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.1" if c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"].to_f < 15.1\n      end\n    end\n/' ios/Podfile
fi
# Personal teams can't sign push notifications or Apple Pay.
for ent in ios/tazdan/*.entitlements; do
  /usr/libexec/PlistBuddy -c 'Delete :aps-environment' "$ent" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c 'Delete :com.apple.developer.in-app-payments' "$ent" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c 'Delete :com.apple.developer.associated-domains' "$ent" 2>/dev/null || true
done
touch ios/.tazdan-local-test-prebuild-complete
fi

# Native dependencies can change even when the generated project is reused.
(cd ios && pod install > "$output_dir/pods.log" 2>&1) || { tail -40 "$output_dir/pods.log" >&2; exit 1; }
if ! grep -q 'ExtensionStorageModule.self' 'ios/Pods/Target Support Files/Pods-tazdan/ExpoModulesProvider.swift'; then
  echo "Widget storage is not linked. Check the iOS deployment target (at least 16.4) and regenerate the native project." >&2
  exit 1
fi

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
  DEVELOPMENT_TEAM="$team_id" \
  CODE_SIGN_STYLE=Automatic \
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

echo "Note: ios/ now holds the local test project. Run 'npx expo prebuild --platform ios --clean' before a normal native build."
