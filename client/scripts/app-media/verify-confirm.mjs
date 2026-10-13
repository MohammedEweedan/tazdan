#!/usr/bin/env node
// Exercise the real payment review control with network-intercepted fixtures.
import assert from 'node:assert/strict';
import { launch, bootSignedIn, nav, setStore, sleep } from './harness.mjs';

const { browser, page, errors, unmatched } = await launch({ locale: 'en', theme: 'dark', dsf: 1 });
const sends = [];
const orders = [];
page.on('request', request => {
  if (request.method() === 'POST' && /\/(transfers\/send|transactions\/transfer)$/.test(new URL(request.url()).pathname)) sends.push(request.postDataJSON());
  if (request.method() === 'POST' && /\/exchange\/execute$/.test(new URL(request.url()).pathname)) orders.push(request.postDataJSON());
});
try {
  await bootSignedIn(page, { locale: 'en' });
  await setStore(page, 'authStore', { biometricEnabled: true });
  async function review() {
    await nav(page, '/profile', 350);
    await nav(page, '/send', 1100);
    await page.locator('input').filter({ visible: true }).first().fill('omar');
    await page.getByText('Omar Ben Ali', { exact: false }).filter({ visible: true }).first().click();
    for (const digit of '250') await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    return page.getByRole('dialog').getByRole('button').filter({ hasText: 'Send' }).last();
  }
  const confirm = await review();
  await confirm.evaluate(node => { node.click(); node.click(); });
  await page.getByText('Transfer sent!', { exact: true }).waitFor({ timeout: 8000 });
  assert.equal(sends.length, 1, 'Rapid repeated confirmation must submit once');

  const before = sends.length;
  const changed = await review();
  await changed.evaluate(node => {
    node.click();
    // Simulate an amount changing while the review dismissal is pending.
    document.querySelector('[role="button"][aria-label="1"]').click();
  });
  await sleep(1000);
  assert.equal(sends.length, before, 'A changed amount must require a fresh review');

  await nav(page, '/profile', 350);
  await nav(page, '/buy', 1100);
  for (const digit of '500') await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const timer = page.getByRole('dialog').getByText(/^\d+s$/).first();
  const originalTimer = await timer.innerText();
  await page.waitForFunction(old => [...document.querySelectorAll('[role="dialog"] *')].some(node => /^\d+s$/.test(node.textContent) && node.textContent !== old), originalTimer);
  await sleep(850);
  await page.getByRole('dialog').getByRole('button').filter({ hasText: 'Buy' }).last().click();
  await page.waitForTimeout(1200);
  assert.equal(orders.length, 1, 'A countdown tick must not cancel an otherwise unchanged quote');
  assert.deepEqual([...unmatched], []);
  assert.deepEqual(errors.filter(e => /pageerror:/.test(e)), []);
  console.log('Payment review passed: repeated taps submit once; changed amount cancels; countdown ticks preserve valid quotes.');
} finally {
  await browser.close();
}
