import Constants from 'expo-constants';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';
import { resolveApiBase } from './apiEndpoint';

export const API_BASE_URL = resolveApiBase({
  development: __DEV__,
  platform: Platform.OS,
  isDevice,
  metroHost: Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost,
  webHostname: typeof window !== 'undefined' ? window.location?.hostname : undefined,
  developmentBase: process.env.EXPO_PUBLIC_DEV_API_BASE,
  localTestBuild: process.env.EXPO_PUBLIC_LOCAL_TEST_BUILD === '1',
  localTestBase: process.env.EXPO_PUBLIC_LOCAL_TEST_API_BASE,
  productionBase: process.env.EXPO_PUBLIC_PROD_API_BASE,
  legacyBase: process.env.EXPO_PUBLIC_API_BASE,
  port: process.env.EXPO_PUBLIC_DEV_API_PORT,
});
