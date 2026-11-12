// Xcode 27 replaced Simulator.app with DeviceHub (com.apple.dt.Devices). The
// SDK 54 Expo CLI only knows "Simulator", so `expo start --ios` and
// `expo run:ios` stop with "Can't determine id of Simulator app". This
// backports the upstream fix (@expo/cli 58): accept DeviceHub, detect it as
// running, and open a device through its `devices://` URL.
const fs = require('node:fs');
const path = require('node:path');

const cli = path.dirname(require.resolve('@expo/cli/package.json', { paths: [path.dirname(require.resolve('expo/package.json'))] }));
const MARK = '/* tazdan: Xcode 27 DeviceHub */';

const patches = [
  {
    file: 'build/src/start/doctor/apple/SimulatorAppPrerequisite.js',
    edits: [
      [
        `async function getSimulatorAppIdAsync() {
    return await getSimulatorAppIdViaAppleScriptAsync() ?? await getSimulatorAppIdFromBundleAsync();
}`,
        `async function getSimulatorAppIdAsync() {
    return await getSimulatorAppIdViaAppleScriptAsync() ?? await getSimulatorAppIdFromBundleAsync() ?? await getDeviceHubAppIdAsync();
}
${MARK}
async function getDeviceHubAppIdAsync() {
    try {
        return (await (0, _osascript().execAsync)('id of app "DeviceHub"')).trim() || null;
    } catch  {}
    try {
        const { stdout: developerDir } = await (0, _spawnasync().default)('xcode-select', [
            '--print-path'
        ]);
        const { stdout: bundleId } = await (0, _spawnasync().default)('defaults', [
            'read',
            _path().default.join(developerDir.trim(), '..', 'Applications', 'DeviceHub.app', 'Contents', 'Info.plist'),
            'CFBundleIdentifier'
        ]);
        return bundleId.trim() || null;
    } catch  {}
    return null;
}`,
      ],
      [
        `if (result !== 'com.apple.iphonesimulator' && result !== 'com.apple.CoreSimulator.SimulatorTrampoline') {`,
        `if (result !== 'com.apple.dt.Devices' && result !== 'com.apple.iphonesimulator' && result !== 'com.apple.CoreSimulator.SimulatorTrampoline') {`,
      ],
    ],
  },
  {
    file: 'build/src/start/platforms/ios/ensureSimulatorAppRunning.js',
    edits: [
      [
        `count processes whose name is "Simulator"')`,
        `count processes whose name is "Simulator" or name is "DeviceHub"')`,
      ],
      [
        `    await (0, _spawnasync().default)('open', args);
}`,
        `    ${MARK}
    try {
        await (0, _spawnasync().default)('open', args);
    } catch  {
        // DeviceHub registers devices:// — it can focus a device by UDID.
        await (0, _spawnasync().default)('open', device.udid ? [
            \`devices://device/open?id=\${device.udid}\`
        ] : [
            '-a',
            'DeviceHub'
        ]).catch(()=>{});
    }
}`,
      ],
    ],
  },
  {
    file: 'build/src/start/platforms/ios/AppleDeviceManager.js',
    edits: [
      [
        'await _osascript().execAsync(`tell application "Simulator" to activate`);',
        `${MARK} await _osascript().execAsync([
            'if application "Simulator" is running then',
            'tell application "Simulator" to activate',
            'else if application "DeviceHub" is running then',
            'tell application "DeviceHub" to activate',
            'end if'
        ].join('\\n'));`,
      ],
    ],
  },
];

for (const { file, edits } of patches) {
  const target = path.join(cli, file);
  let source = fs.readFileSync(target, 'utf8');
  if (source.includes(MARK)) continue;
  for (const [old, replacement] of edits) {
    if (!source.includes(old)) throw new Error(`@expo/cli changed (${file}); review the Xcode 27 DeviceHub patch`);
    source = source.replace(old, replacement);
  }
  fs.writeFileSync(target, source);
}
console.log('Expo CLI accepts Xcode 27 DeviceHub as the iOS simulator app');
