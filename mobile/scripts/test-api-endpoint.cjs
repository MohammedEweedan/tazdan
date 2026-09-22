const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/constants/apiEndpoint.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {}, URL }; vm.runInNewContext(compiled, sandbox);
const { resolveApiBase: resolve } = sandbox.exports;
const dev = { development: true, platform: 'ios' };
const prod = { development: false, platform: 'ios' };
const cases = [
  ['iOS simulator', dev, 'http://localhost:5001/api'],
  ['physical LAN device', {...dev, isDevice:true, metroHost:'192.168.1.9:8081'}, 'http://192.168.1.9:5001/api'],
  ['Metro scheme', {...dev, metroHost:'exp://10.1.2.3:8081'}, 'http://10.1.2.3:5001/api'],
  ['Android emulator', {...dev, platform:'android', isDevice:false, metroHost:'localhost:8081'}, 'http://10.0.2.2:5001/api'],
  ['Android real device', {...dev, platform:'android', isDevice:true, metroHost:'192.168.1.9:8081'}, 'http://192.168.1.9:5001/api'],
  ['LAN browser', {...dev, platform:'web', webHostname:'192.168.1.8'}, 'http://192.168.1.8:5001/api'],
  ['IPv6', {...dev, metroHost:'[::1]:8081'}, 'http://[::1]:5001/api'],
  ['port override', {...dev, port:'5050'}, 'http://localhost:5050/api'],
  ['dev override', {...dev, developmentBase:'http://192.168.1.5:5001/api/'}, 'http://192.168.1.5:5001/api'],
  ['production default ignores Metro/dev', {...prod, metroHost:'localhost:8081', developmentBase:'http://localhost:5001'}, 'https://api.promrkts.com'],
  ['production proxy', {...prod, productionBase:'https://api.promrkts.com/api/'}, 'https://api.promrkts.com'],
  ['custom production', {...prod, productionBase:'https://api.example.com'}, 'https://api.example.com/api'],
  ['production wins over legacy local', {...prod, productionBase:'https://api.promrkts.com', legacyBase:'http://localhost:5001'}, 'https://api.promrkts.com'],
];
for(const [name, env, expected] of cases) assert.equal(resolve(env), expected, name);
for(const base of ['http://api.example.com', 'https://localhost:5001', 'https://192.168.1.9', 'https://172.20.1.1', 'https://[::1]', 'https://user:pass@api.example.com', 'https://api.example.com?token=1']) {
 assert.throws(()=>resolve({...prod, productionBase:base}), undefined, base);
}
assert.throws(()=>resolve({...dev, port:'banana'}));
console.log(`API routing: ${cases.length} connection scenarios and 8 invalid-config checks passed.`);
