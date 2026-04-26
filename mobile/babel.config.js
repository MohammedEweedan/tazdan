/**
 * Babel config for Expo SDK 54.
 *
 *  - NativeWind's global JSX-import-source pragma was disabled. It was
 *    intercepting every <View>/<Pressable>/<Text> through its interop and
 *    dropping `flexDirection: 'row'` on real iOS devices when used with
 *    function-style `style={({ pressed }) => ({ ... })}` props. Layout was
 *    fine in RN-Web but broke in Expo Go — see commit notes for repro.
 *
 *    The codebase uses inline `style={{ ... }}` everywhere; the few legacy
 *    files that still use `className="…"` (register.tsx + a couple of unused
 *    components in src/components/**) silently ignore the prop on native
 *    without breaking. Re-enable NativeWind per-file with the pragma:
 *      // @jsxImportSource nativewind
 *
 *  - Reanimated 4 split its babel plugin into `react-native-worklets/plugin`.
 *    This plugin must remain the LAST entry — it processes worklet directives.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-worklets/plugin', // KEEP LAST — Reanimated 4 worklets
    ],
  };
};
