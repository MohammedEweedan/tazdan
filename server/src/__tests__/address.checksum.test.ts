import { validateAddress } from '../utils/addressValidation';
it('verifies BTC and TRON checksums before any debit', () => {
  const btc = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
  const tron = 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8';
  expect(() => validateAddress('BTC', btc)).not.toThrow();
  expect(() => validateAddress('TRON', tron)).not.toThrow();
  expect(() => validateAddress('BTC', btc.slice(0, -1) + 'U')).toThrow();
  expect(() => validateAddress('TRON', tron.slice(0, -1) + '9')).toThrow();
  expect(() => validateAddress('SOL', 'z'.repeat(32))).toThrow();
  expect(() => validateAddress('SOL', '11111111111111111111111111111111')).not.toThrow();
});
