/**
 * App entry. expo-router renders the app; on Android the home-screen widget
 * task is registered beside it (src/widgets/android). A binary built before
 * the widget module existed throws on load — it then simply has no widgets.
 */
import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { widgetTaskHandler } = require('./src/widgets/android/taskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // No widget support in this build.
  }
}
