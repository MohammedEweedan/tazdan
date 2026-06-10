/**
 * Admin route layout — all admin pages share a hidden header (each
 * screen builds its own) and are stack-nested under /admin.
 *
 * The role gate lives HERE, not per-screen: every /admin/* route is
 * unreachable for non-admins, including deep links and push payloads.
 * (The server independently 403s all /api/admin data — this gate is
 * about never rendering the console shell to a non-admin at all.)
 */

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AdminLayout() {
  const router = useRouter();
  const { user, isHydrating, isAuthenticated } = useAuthStore();
  const isAdmin = isAuthenticated && user?.role === 'ADMIN';

  useEffect(() => {
    if (isHydrating) return;
    if (!isAdmin) router.replace('/(tabs)');
  }, [isAdmin, isHydrating, router]);

  // Render nothing until the gate decides — no admin chrome flash.
  if (isHydrating || !isAdmin) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
