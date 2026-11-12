/**
 * Hand the snapshot to the platform's widgets and ask them to redraw.
 *
 * Older binaries and Expo Go can lack widget support. Report failures once
 * so a missing bridge cannot silently look like a successful sync.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { WIDGET_APP_GROUP, WIDGET_NAMES, WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from './snapshot';

interface WidgetStorage {
  setString(key: string, value: string, group: string): void;
  get(key: string, group: string): string | null;
  remove(key: string, group: string): void;
  reloadWidget(kind?: string): void;
}

let reportedFailure = false;

export async function publishWidgetSnapshot(snapshot: WidgetSnapshot | null): Promise<boolean> {
  const json = snapshot ? JSON.stringify(snapshot) : null;
  try {
    if (Platform.OS === 'ios') {
      // The package's JS wrapper silently no-ops when its pod is not linked.
      const storage = requireOptionalNativeModule<WidgetStorage>('ExtensionStorage');
      if (!storage) throw new Error('ExtensionStorage is missing. Rebuild iOS with the widget storage pod linked.');
      // Match Snapshot.swift using the installed binary, even when Metro was
      // started without the local-test environment variables.
      const application = requireOptionalNativeModule<{ applicationId: string }>('ExpoApplication');
      const group = application?.applicationId ? `group.${application.applicationId}` : WIDGET_APP_GROUP;
      if (json) storage.setString(WIDGET_SNAPSHOT_KEY, json, group);
      else storage.remove(WIDGET_SNAPSHOT_KEY, group);
      if ((storage.get(WIDGET_SNAPSHOT_KEY, group) ?? null) !== json) {
        throw new Error(`Widget snapshot did not persist in ${group}. Check App Group entitlements.`);
      }
      storage.reloadWidget();
    } else if (Platform.OS === 'android') {
      if (json) await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, json);
      else await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY);
      // Loading the library throws on a binary without its native module.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
      const { renderWidget } = await import('./android/widgets');
      await Promise.all(WIDGET_NAMES.map((widgetName) => requestWidgetUpdate({
        widgetName,
        renderWidget: (info) => renderWidget(widgetName, snapshot, { width: info.width, height: info.height }, { lang: snapshot?.locale }),
      })));
    }
    reportedFailure = false;
    return true;
  } catch (error) {
    if (!reportedFailure) console.warn('[widgets] Snapshot sync failed:', error);
    reportedFailure = true;
    return false;
  }
}
