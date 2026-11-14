// image-size 2 removes synchronous path input. Metro 0.83 still passes a
// path, so read the file as bytes before calling the patched parser.
const fs = require('node:fs');
const file = require('node:path').join(require('node:path').dirname(require.resolve('metro')), 'Assets.js');
const old = `const isImageInput = assetInfo.files[0].includes(".zip/")
    ? _fs.default.readFileSync(assetInfo.files[0])
    : assetInfo.files[0];`;
const replacement = 'const isImageInput = _fs.default.readFileSync(assetInfo.files[0]);';
const source = fs.readFileSync(file, 'utf8');
if (source.includes(replacement)) process.exit(0);
if (!source.includes(old)) throw new Error('Metro asset adapter changed; review the image-size compatibility patch');
fs.writeFileSync(file, source.replace(old, replacement));
console.log('Metro reads asset bytes for the patched image-size parser');
