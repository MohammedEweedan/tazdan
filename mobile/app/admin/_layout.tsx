/**
 * Admin route layout — all admin pages share a hidden header (each
 * screen builds its own) and are stack-nested under /admin.
 */

import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
