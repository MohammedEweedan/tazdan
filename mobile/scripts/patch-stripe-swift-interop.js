const fs = require('fs');
const path = require('path');

const headerPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@stripe',
  'stripe-react-native',
  'ios',
  'StripeSwiftInterop.h',
);

if (!fs.existsSync(headerPath)) {
  console.warn('[patch-stripe] StripeSwiftInterop.h not found; skipping.');
  process.exit(0);
}

const source = fs.readFileSync(headerPath, 'utf8');
const before = 'typedef NS_ENUM(NSUInteger, STPPaymentStatus);';
const after = 'typedef NS_ENUM(NSInteger, STPPaymentStatus);';

if (source.includes(after)) {
  console.log('[patch-stripe] STPPaymentStatus already uses NSInteger.');
  process.exit(0);
}

if (!source.includes(before)) {
  console.warn('[patch-stripe] Expected STPPaymentStatus typedef was not found; skipping.');
  process.exit(0);
}

fs.writeFileSync(headerPath, source.replace(before, after));
console.log('[patch-stripe] Patched STPPaymentStatus enum underlying type.');
