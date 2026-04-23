'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Flex, Spinner } from '@chakra-ui/react';
import { useAuthStore } from '@/stores/authStore';
import AdminSidebar from '@/components/layout/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, fetchUser, user } = useAuthStore();

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
    if (!isLoading && isAuthenticated && user?.role !== 'ADMIN') router.push('/dashboard');
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="brand.500" thickness="3px" />
      </Flex>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') return null;

  return (
    <Box minH="100vh">
      <AdminSidebar />
      <Box ms="64" minH="100vh" p={6}>
        {children}
      </Box>
    </Box>
  );
}
