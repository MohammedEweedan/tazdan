/**
 * Expo config. app.json is the source of truth; this file only derives the
 * local iPhone test variant (TAZDAN_LOCAL_TEST=1, set by
 * scripts/ios-local-test.sh): its own bundle ID, widget extension and App
 * Group signed by a personal team, without the Apple Pay and Associated
 * Domains entitlements personal teams can't sign. Every other build gets
 * app.json unchanged.
 */
module.exports = ({ config }) => {
  if (process.env.TAZDAN_LOCAL_TEST !== '1') return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.tazdan.localtest',
      appleTeamId: process.env.LOCAL_TEST_TEAM_ID || config.ios.appleTeamId,
      associatedDomains: [],
      entitlements: { 'com.apple.security.application-groups': ['group.com.tazdan.localtest'] },
      infoPlist: { ...config.ios.infoPlist, CFBundleDisplayName: 'tazdan test' },
    },
  };
};
