'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box, VStack, HStack, Text, Icon, Flex, Button, useColorModeValue,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import {
  FiGrid, FiArrowDownCircle, FiArrowUpCircle, FiUsers,
  FiShield, FiDollarSign, FiSettings, FiLogOut, FiTrendingUp, FiList,
} from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import ColorModeToggle from '@/components/ui/ColorModeToggle';

export default function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useTranslate();
  const { logout } = useAuthStore();
  const sidebarBg = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.800');
  const activeBg = useColorModeValue('brand.50', 'brand.900');
  const activeColor = useColorModeValue('brand.600', 'brand.300');

  const navItems = [
    { href: '/admin', labelKey: 'admin_dashboard', icon: FiGrid },
    { href: '/admin/deposits', labelKey: 'admin_manage_deposits', icon: FiArrowDownCircle },
    { href: '/admin/withdrawals', labelKey: 'admin_manage_withdrawals', icon: FiArrowUpCircle },
    { href: '/admin/orders', labelKey: 'admin_orders', icon: FiList },
    { href: '/admin/rates', labelKey: 'admin_exchange_rates', icon: FiDollarSign },
    { href: '/admin/users', labelKey: 'admin_manage_users', icon: FiUsers },
    { href: '/admin/kyc', labelKey: 'admin_manage_kyc', icon: FiShield },
    { href: '/admin/settings', labelKey: 'admin_settings', icon: FiSettings },
  ];

  return (
    <Box as="aside" pos="fixed" left={0} top={0} zIndex={40} h="100vh" w="64" borderRightWidth="1px" borderColor={borderColor} bg={sidebarBg} display="flex" flexDirection="column">
      <HStack spacing={2.5} px={5} py={5} borderBottomWidth="1px" borderColor={borderColor}>
        <Flex align="center" justify="center" w={9} h={9} rounded="lg" bgGradient="linear(to-br, red.500, orange.500)">
          <Icon as={FiTrendingUp} color="white" boxSize={5} />
        </Flex>
        <Box>
          <Text fontSize="lg" fontWeight="bold">{t('app_name')}</Text>
          <Text fontSize="xs" color="red.400" fontWeight="semibold">ADMIN</Text>
        </Box>
      </HStack>

      <Box flex={1} overflowY="auto" px={3} py={4}>
        <VStack spacing={1} align="stretch">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
            return (
              <Button
                key={item.href}
                as={NextLink}
                href={item.href}
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<Icon as={item.icon} boxSize={4} />}
                bg={isActive ? activeBg : 'transparent'}
                color={isActive ? activeColor : undefined}
                _hover={{ bg: isActive ? activeBg : hoverBg }}
                fontSize="sm"
                fontWeight="medium"
                h={10}
              >
                {t(item.labelKey)}
              </Button>
            );
          })}
        </VStack>
      </Box>

      <Box px={3} py={3} borderTopWidth="1px" borderColor={borderColor}>
        <HStack justify="center" mb={2}>
          <LanguageSwitcher />
          <ColorModeToggle />
        </HStack>
        <Button variant="ghost" w="full" justifyContent="flex-start" leftIcon={<Icon as={FiLogOut} />} color="red.400" _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }} fontSize="sm" onClick={logout}>
          {t('nav_sign_out')}
        </Button>
      </Box>
    </Box>
  );
}
