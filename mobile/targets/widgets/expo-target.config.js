/**
 * iOS home-screen widgets (WidgetKit): Payments, Chats and Holdings.
 * The app writes one JSON snapshot into the shared App Group
 * (src/widgets/publish.ts); the widgets read it and refresh prices from the
 * public feeds on their own. See src/widgets/snapshot.ts for the contract.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'TazdanWidgets',
  displayName: 'tazdan',
  bundleIdentifier: '.widgets',
  // Widgets appear on iOS 16+; containerBackground is used from iOS 17.
  deploymentTarget: '16.0',
  colors: {
    $widgetBackground: { light: '#F6F7FA', dark: '#16181C' },
    $accent: { light: '#24384F', dark: '#9BA8B7' },
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
