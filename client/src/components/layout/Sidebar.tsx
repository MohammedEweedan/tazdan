'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box, VStack, HStack, Text, Icon, Flex, Badge, Button, Divider, useColorModeValue,
  useBreakpointValue, IconButton, Collapse, useDisclosure, Avatar, Tooltip,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import {
  FiGrid, FiArrowDownCircle, FiArrowUpCircle, FiRepeat,
  FiCreditCard, FiList, FiShield, FiSettings, FiLogOut, FiTrendingUp,
  FiMenu, FiX, FiHome, FiActivity, FiPieChart, FiUser, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import ColorModeToggle from '@/components/ui/ColorModeToggle';

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslate();
  const { user, logout } = useAuthStore();
  const { isOpen, onToggle } = useDisclosure();
  
  const isMobile = useBreakpointValue({ base: true, md: false });
  const isCollapsed = useBreakpointValue({ base: !isOpen, md: false });
  
  const sidebarBg = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.800');
  const activeBg = useColorModeValue('brand.50', 'brand.900');
  const activeColor = useColorModeValue('brand.600', 'brand.300');
  const subtleText = useColorModeValue('gray.500', 'gray.400');

  const navItems = [
    { href: '/dashboard', labelKey: 'nav_dashboard', icon: FiHome },
    { href: '/dashboard/trade', labelKey: 'nav_trade', icon: FiRepeat },
    { href: '/dashboard/deposit', labelKey: 'nav_deposit', icon: FiArrowDownCircle },
    { href: '/dashboard/withdraw', labelKey: 'nav_withdraw', icon: FiArrowUpCircle },
    { href: '/dashboard/wallet', labelKey: 'nav_wallets', icon: FiCreditCard },
    { href: '/dashboard/orders', labelKey: 'nav_orders', icon: FiList },
    { href: '/dashboard/portfolio', labelKey: 'nav_portfolio', icon: FiPieChart },
    { href: '/dashboard/activity', labelKey: 'nav_activity', icon: FiActivity },
    { href: '/dashboard/kyc', labelKey: 'nav_kyc', icon: FiShield },
    { href: '/dashboard/settings', labelKey: 'nav_settings', icon: FiSettings },
  ];

  const kycColor = user?.kycStatus === 'APPROVED' ? 'blue' : user?.kycStatus === 'PENDING' ? 'yellow' : 'red';
  const kycLabel = user?.kycStatus === 'APPROVED' ? t('kyc_approved') : user?.kycStatus === 'PENDING' ? t('kyc_pending') : t('kyc_not_submitted');

  const sidebarWidth = isCollapsed ? '60px' : '280px';
  const sidebarDisplay = isMobile ? (isOpen ? 'block' : 'none') : 'block';

  return (
    <>
      {/* Mobile Menu Toggle */}
      {isMobile && (
        <IconButton
          position="fixed"
          top={4}
          left={4}
          zIndex={50}
          aria-label="Toggle menu"
          icon={isOpen ? <FiX /> : <FiMenu />}
          onClick={onToggle}
          bg={sidebarBg}
          border="1px"
          borderColor={borderColor}
          boxShadow="md"
        />
      )}

      {/* Sidebar */}
      <Box
        as="aside"
        position="fixed"
        left={0}
        top={0}
        zIndex={40}
        h="100vh"
        w={sidebarWidth}
        borderRightWidth="1px"
        borderColor={borderColor}
        bg={sidebarBg}
        display={sidebarDisplay}
        flexDirection="column"
        transition="all 0.3s ease"
        boxShadow={isMobile ? 'xl' : 'none'}
      >
        {/* Header */}
        <HStack spacing={3} px={isCollapsed ? 2 : 5} py={4} borderBottomWidth="1px" borderColor={borderColor} justify={isCollapsed ? 'center' : 'flex-start'}>
          <Flex align="center" justify="center" w={8} h={8} rounded="lg" bgGradient="linear(135deg, brand.500, accent.500)">
            <Icon as={FiTrendingUp} color="white" boxSize={4} />
          </Flex>
          <Collapse in={!isCollapsed} animateOpacity>
            <Text fontSize="lg" fontWeight="bold" bgGradient="linear(135deg, brand.500, accent.500)" bgClip="text">
              {t('app_name')}
            </Text>
          </Collapse>
          {!isMobile && (
            <IconButton
              ml="auto"
              aria-label="Toggle sidebar"
              icon={isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
              onClick={onToggle}
              variant="ghost"
              size="sm"
            />
          )}
        </HStack>

        {/* User info */}
        <Box px={isCollapsed ? 2 : 5} py={4} borderBottomWidth="1px" borderColor={borderColor}>
          <Flex align="center" gap={3} justify={isCollapsed ? 'center' : 'flex-start'}>
            <Avatar size="sm" name={`${user?.firstName} ${user?.lastName}`} />
            <Collapse in={!isCollapsed} animateOpacity>
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" fontWeight="semibold">{user?.firstName} {user?.lastName}</Text>
                <Text fontSize="xs" color={subtleText}>{user?.email}</Text>
                <Badge colorScheme={kycColor} fontSize="xs">{kycLabel}</Badge>
              </VStack>
            </Collapse>
          </Flex>
        </Box>

        {/* Navigation */}
        <Box flex={1} overflowY="auto" px={isCollapsed ? 1 : 3} py={4}>
          <VStack spacing={1} align="stretch">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Tooltip
                  key={item.href}
                  label={t(item.labelKey)}
                  placement="right"
                  isDisabled={!isCollapsed}
                  hasArrow
                >
                  <Button
                    as={NextLink}
                    href={item.href}
                    variant="ghost"
                    justifyContent={isCollapsed ? 'center' : 'flex-start'}
                    leftIcon={<Icon as={item.icon} boxSize={4} />}
                    bg={isActive ? activeBg : 'transparent'}
                    color={isActive ? activeColor : undefined}
                    _hover={{ bg: isActive ? activeBg : hoverBg }}
                    fontSize="sm"
                    fontWeight="medium"
                    h={10}
                    px={isCollapsed ? 2 : 3}
                  >
                    <Collapse in={!isCollapsed} animateOpacity>
                      {t(item.labelKey)}
                    </Collapse>
                  </Button>
                </Tooltip>
              );
            })}
          </VStack>
        </Box>

        {/* Bottom */}
        <Box px={isCollapsed ? 2 : 3} py={3} borderTopWidth="1px" borderColor={borderColor}>
          <Collapse in={!isCollapsed} animateOpacity>
            <HStack justify="center" mb={2}>
              <LanguageSwitcher />
              <ColorModeToggle />
            </HStack>
          </Collapse>
          <Tooltip
            label={t('nav_sign_out')}
            placement="right"
            isDisabled={!isCollapsed}
            hasArrow
          >
            <Button
              variant="ghost"
              w={isCollapsed ? 'auto' : 'full'}
              justifyContent={isCollapsed ? 'center' : 'flex-start'}
              leftIcon={<Icon as={FiLogOut} />}
              color="red.400"
              _hover={{ bg: 'red.50', _dark: { bg: 'red.900' } }}
              fontSize="sm"
              onClick={logout}
              px={isCollapsed ? 2 : 3}
            >
              <Collapse in={!isCollapsed} animateOpacity>
                {t('nav_sign_out')}
              </Collapse>
            </Button>
          </Tooltip>
        </Box>
      </Box>

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.50"
          zIndex={30}
          onClick={onToggle}
        />
      )}
    </>
  );
}
