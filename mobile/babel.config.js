/**
 * Babel config for Expo SDK 54.
 *
 *  - `babel-preset-expo` is now JSX-import-source aware (nativewind).
 *  - Reanimated 4 split its babel plugin into `react-native-worklets/plugin`.
 *    This plugin must remain the LAST entry — it processes worklet directives.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-worklets/plugin', // KEEP LAST — Reanimated 4 worklets
    ],
  };
};
