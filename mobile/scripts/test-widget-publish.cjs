const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/widgets/publish.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const key = 'tazdan.widgets.snapshot';
const snapshot = { v: 1, locale: 'en', holdings: [], payments: [], chats: { unread: 0, items: [] } };

function publisher({ bundle = 'com.tazdan.app', storage, platform = 'ios' } = {}) {
  const warnings = [];
  const sandbox = {
    exports: {},
    console: { warn: (...args) => warnings.push(args) },
    require(name) {
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === '@react-native-async-storage/async-storage') return {};
      if (name === 'expo') return {
        requireOptionalNativeModule: (module) => module === 'ExpoApplication' ? { applicationId: bundle } : storage,
      };
      if (name === './snapshot') return {
        WIDGET_APP_GROUP: 'group.com.tazdan.app', WIDGET_SNAPSHOT_KEY: key,
        WIDGET_NAMES: ['TazdanPayments', 'TazdanChats', 'TazdanHoldings'],
      };
      // The dependency's fallback wrapper can make a missing pod appear to
      // succeed. The publisher must check the actual native module instead.
      if (name === '@bacons/apple-targets') return {
        ExtensionStorage: class { set() {} remove() {} static reloadWidget() {} },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(compiled, sandbox);
  return { publish: sandbox.exports.publishWidgetSnapshot, warnings };
}

function nativeStorage({ discardWrites = false } = {}) {
  const values = new Map();
  const calls = [];
  return {
    values, calls,
    setString(k, value, group) {
      calls.push(['set', k, group]);
      if (!discardWrites) values.set(`${group}/${k}`, value);
    },
    get(k, group) { return values.get(`${group}/${k}`) ?? null; },
    remove(k, group) { calls.push(['remove', k, group]); values.delete(`${group}/${k}`); },
    reloadWidget() { calls.push(['reload']); },
  };
}

(async () => {
  // Regression: no pod used to silently succeed through the JS wrapper.
  const missing = publisher();
  assert.equal(await missing.publish(snapshot), false);
  assert.equal(await missing.publish(snapshot), false);
  assert.equal(missing.warnings.length, 1, 'missing bridge is reported once');

  for (const bundle of ['com.tazdan.app', 'com.tazdan.localtest']) {
    const storage = nativeStorage();
    const { publish, warnings } = publisher({ bundle, storage });
    assert.equal(await publish(snapshot), true);
    assert.deepEqual(JSON.parse(storage.get(key, `group.${bundle}`)), snapshot);
    assert.deepEqual(storage.calls.map((c) => c[0]), ['set', 'reload']);
    assert.equal(warnings.length, 0);
    // Sign-out must remove the same snapshot and reload all three widgets.
    assert.equal(await publish(null), true);
    assert.equal(storage.get(key, `group.${bundle}`), null);
    assert.deepEqual(storage.calls.slice(-2).map((c) => c[0]), ['remove', 'reload']);
  }

  const discarded = nativeStorage({ discardWrites: true });
  const failedWrite = publisher({ storage: discarded });
  assert.equal(await failedWrite.publish(snapshot), false);
  assert.equal(discarded.calls.some((c) => c[0] === 'reload'), false, 'do not reload after a failed write');
  assert.equal(failedWrite.warnings.length, 1);

  // A failed clear must also be detectable, leaving no false success on logout.
  const stale = nativeStorage();
  stale.setString(key, JSON.stringify(snapshot), 'group.com.tazdan.app');
  stale.remove = () => {};
  assert.equal(await publisher({ storage: stale }).publish(null), false);

  // Widget support must never make an older native binary crash on startup.
  const broken = publisher({ storage: { setString() { throw new Error('native failure'); } } });
  assert.equal(await broken.publish(snapshot), false);

  console.log('Widget publishing: missing bridge, production/local App Groups, sign-out, failed persistence and native errors passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
