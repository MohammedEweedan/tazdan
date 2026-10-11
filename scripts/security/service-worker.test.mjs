import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = { self: { location: { origin: 'https://test.example' }, addEventListener() {} }, URL };
vm.createContext(context); vm.runInContext(fs.readFileSync('client/public/sw.js', 'utf8'), context);
const asset = (url, extra = {}) => context.publicAsset({ method: 'GET', mode: 'cors', headers: { has: () => false }, url: 'https://test.example' + url, ...extra });
test('public assets can be cached', () => { assert.equal(asset('/_next/static/chunk.js'), true); assert.equal(asset('/app/screens/home.webp'), true); });
test('financial pages, API, private documents and authenticated requests never enter the cache', () => {
  for (const path of ['/account', '/api/wallets', '/uploads/identity.png', '/sw.js', '/app/screens/home.webp?user=123']) assert.equal(asset(path), false);
  assert.equal(asset('/_next/static/chunk.js', { method: 'POST' }), false);
  assert.equal(asset('/app/screens/home.webp', { mode: 'navigate' }), false);
  assert.equal(asset('/app/screens/home.webp', { headers: { has: () => true } }), false);
  assert.equal(asset('/app/screens/home.webp', { url: 'https://other.example/app/screens/home.webp' }), false);
});
