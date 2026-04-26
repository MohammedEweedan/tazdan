// NativeWind metro plugin disabled — see babel.config.js for the rationale.
// Re-enable per-file by adding the `// @jsxImportSource nativewind` pragma
// to the top of files that use `className`.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
