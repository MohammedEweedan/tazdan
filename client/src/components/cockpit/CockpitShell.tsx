'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import TwoFactorSetup from './TwoFactorSetup';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Button, Center, Drawer, DrawerBody, DrawerContent, DrawerOverlay, Flex, HStack, Icon, IconButton,
  Input, InputGroup, InputLeftElement, Spinner, Text, useColorMode, useDisclosure, VStack, Badge, Tooltip,
} from '@chakra-ui/react';
import {
  FiGrid, FiUsers, FiList, FiBookOpen, FiSend, FiDollarSign, FiDatabase, FiInbox, FiCheckSquare, FiGitMerge,
  FiServer, FiSliders, FiShield, FiAlertTriangle, FiLifeBuoy, FiBarChart2, FiTrendingUp, FiActivity, FiLock,
  FiFileText, FiUserCheck, FiCpu, FiSearch, FiMenu, FiMoon, FiSun, FiLogOut, FiBriefcase, FiArrowDownCircle, FiArrowUpCircle,
} from 'react-icons/fi';
import { api, ApiError, hasSession, logout } from '@/lib/cockpit/api';
import { initCockpitLang, useCockpitLang, useT } from '@/lib/cockpit/i18n';
import { useCockpitColors } from './ui';

export interface StaffMe {
  user: { id: string; email: string; firstName: string; lastName: string; twoFactorEnabled: boolean };
  roles: string[];
  permissions: string[];
  implicitSuperAdmin: boolean;
  environment: string;
}

const StaffContext = createContext<StaffMe | null>(null);
export const useStaff = () => useContext(StaffContext);
export function useCan() {
  const me = useStaff();
  return (p: string) => Boolean(me?.permissions.includes(p));
}

interface NavItem { href: string; label: string; icon: any; perm: string }
interface NavGroup { label: string; items: NavItem[] }

/** Only pages that exist are listed — no dead links. */
export const NAV: NavGroup[] = [
  { label: 'Command', items: [
    { href: '/admin', label: 'Overview', icon: FiGrid, perm: 'cockpit.view' },
    { href: '/admin/assistant', label: 'Assistant', icon: FiCpu, perm: 'ai.use' },
  ] },
  { label: 'Customers & money', items: [
    { href: '/admin/customers', label: 'Customers', icon: FiUsers, perm: 'customers.read' },
    { href: '/admin/businesses', label: 'Businesses', icon: FiBriefcase, perm: 'businesses.read' },
    { href: '/admin/transactions', label: 'Transactions', icon: FiList, perm: 'transactions.read' },
    { href: '/admin/remittance', label: 'Remittance', icon: FiSend, perm: 'remittance.read' },
    { href: '/admin/fx', label: 'FX', icon: FiDollarSign, perm: 'fx.read' },
    { href: '/admin/treasury', label: 'Treasury', icon: FiDatabase, perm: 'treasury.read' },
    { href: '/admin/treasury/deposit-accounts', label: 'Deposit accounts', icon: FiDatabase, perm: 'treasury.read' },
    { href: '/admin/ledger', label: 'Ledger', icon: FiBookOpen, perm: 'ledger.read' },
  ] },
  { label: 'Operations', items: [
    { href: '/admin/queues/deposits', label: 'Deposits', icon: FiArrowDownCircle, perm: 'deposits.confirm' },
    { href: '/admin/queues/withdrawals', label: 'Withdrawals', icon: FiArrowUpCircle, perm: 'withdrawals.approve' },
    { href: '/admin/queues/kyc', label: 'KYC', icon: FiUserCheck, perm: 'customers.kyc.review' },
    { href: '/admin/approvals', label: 'Approvals', icon: FiCheckSquare, perm: 'cockpit.view' },
    { href: '/admin/reconciliation', label: 'Reconciliation', icon: FiGitMerge, perm: 'recon.read' },
    { href: '/admin/providers', label: 'Providers', icon: FiServer, perm: 'providers.read' },
    { href: '/admin/controls', label: 'Controls', icon: FiSliders, perm: 'controls.read' },
  ] },
  { label: 'Risk', items: [
    { href: '/admin/compliance', label: 'Compliance', icon: FiShield, perm: 'compliance.read' },
    { href: '/admin/fraud', label: 'Fraud', icon: FiAlertTriangle, perm: 'fraud.read' },
  ] },
  { label: 'Service & finance', items: [
    { href: '/admin/support', label: 'Support', icon: FiLifeBuoy, perm: 'support.read' },
    { href: '/admin/finance', label: 'Finance', icon: FiBarChart2, perm: 'finance.read' },
    { href: '/admin/forecasts', label: 'Forecasts', icon: FiTrendingUp, perm: 'forecast.read' },
  ] },
  { label: 'Platform', items: [
    { href: '/admin/system', label: 'System health', icon: FiActivity, perm: 'system.read' },
    { href: '/admin/security', label: 'Security', icon: FiLock, perm: 'security.read' },
    { href: '/admin/audit', label: 'Audit', icon: FiFileText, perm: 'audit.read' },
    { href: '/admin/staff', label: 'Staff & roles', icon: FiInbox, perm: 'staff.manage' },
  ] },
];

/** Routes that exist in this build. Items not listed here are hidden. */
const BUILT = new Set<string>([
  '/admin', '/admin/customers', '/admin/transactions', '/admin/ledger', '/admin/queues/deposits',
  '/admin/queues/withdrawals', '/admin/queues/kyc', '/admin/approvals', '/admin/controls', '/admin/system',
  '/admin/security', '/admin/audit', '/admin/staff', '/admin/remittance', '/admin/fx', '/admin/treasury', '/admin/treasury/deposit-accounts',
  '/admin/providers', '/admin/reconciliation', '/admin/compliance', '/admin/fraud', '/admin/support',
  '/admin/finance', '/admin/forecasts', '/admin/businesses', '/admin/assistant',
]);
export function registerBuiltRoutes(routes: string[]) { routes.forEach((r) => BUILT.add(r)); }

function SideNav({ me, onNavigate }: { me: StaffMe; onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const c = useCockpitColors();
  const t = useT();
  return (
    <VStack align="stretch" spacing={4} py={4}>
      {NAV.map((g) => {
        const items = g.items.filter((i) => BUILT.has(i.href) && me.permissions.includes(i.perm));
        if (!items.length) return null;
        return (
          <Box key={g.label}>
            <Text px={4} mb={1} fontSize="10px" fontWeight={700} letterSpacing="0.08em" textTransform="uppercase" color={c.faint}>{g.label}</Text>
            {items.map((i) => {
              const active = i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href);
              return (
                <Box as={NextLink} key={i.href} href={i.href} onClick={onNavigate} display="flex" alignItems="center" gap={2.5}
                  mx={2} px={2.5} py={1.5} borderRadius="6px" fontSize="13px" fontWeight={active ? 600 : 500}
                  color={active ? c.accentText : c.muted} bg={active ? c.accentSoft : 'transparent'} _hover={{ bg: active ? c.accentSoft : c.surface2, color: active ? c.accentText : c.text }}>
                  <Icon as={i.icon} boxSize={4} />
                  <Text as="span">{t(i.label)}</Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </VStack>
  );
}

export function CockpitShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const c = useCockpitColors();
  const t = useT();
  const lang = useCockpitLang((s) => s.lang);
  const setLang = useCockpitLang((s) => s.setLang);
  const { colorMode, toggleColorMode } = useColorMode();
  const nav = useDisclosure();
  const [me, setMe] = useState<StaffMe | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => { initCockpitLang(); }, []);
  useEffect(() => {
    if (!hasSession()) { router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`); return; }
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function loadMe() {
    api<StaffMe>('/cockpit/me')
      .then((m) => { setNeeds2fa(false); setMe(m); })
      .catch((e: ApiError) => {
        if (e.status === 403 && (e.details as any)?.requires === 'TWO_FACTOR') { setNeeds2fa(true); return; }
        setFailure(e.status === 403 ? e.message : `Could not load your staff profile: ${e.message}`);
      });
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const envBadge = useMemo(() => me?.environment && me.environment !== 'production'
    ? <Badge colorScheme="purple" variant="subtle" fontSize="10px">{me.environment.toUpperCase()}</Badge> : null, [me]);

  if (needs2fa) {
    return <TwoFactorSetup onDone={loadMe} onSignOut={async () => { await logout(); router.replace('/admin/login'); }} />;
  }
  if (failure) {
    return (
      <Center minH="100vh" bg={c.page} p={6} dir={dir}>
        <Box maxW="420px" textAlign="center">
          <Text fontWeight={700} mb={2}>No cockpit access</Text>
          <Text fontSize="sm" color={c.muted} mb={4}>{failure}</Text>
          <Button size="sm" onClick={async () => { await logout(); router.replace('/admin/login'); }}>{t('Sign out')}</Button>
        </Box>
      </Center>
    );
  }
  if (!me) return <Center minH="100vh" bg={c.page}><Spinner color={c.accent} /></Center>;

  return (
    <StaffContext.Provider value={me}>
      <Flex minH="100vh" bg={c.page} dir={dir} color={c.text}>
        <Box as="aside" w="232px" flexShrink={0} display={{ base: 'none', lg: 'block' }} bg={c.surface} borderInlineEnd="1px solid" borderColor={c.border}
          position="sticky" top={0} h="100vh" alignSelf="flex-start" overflowY="auto">
          <HStack px={4} h="56px" borderBottom="1px solid" borderColor={c.border} spacing={2}>
            <Box as="img" src="/icon-asterisk.svg" alt="" w="20px" h="20px" />
            <Text fontWeight={700} fontSize="sm">tazdan</Text>
            <Text fontSize="sm" color={c.muted}>{t('Control Cockpit')}</Text>
          </HStack>
          <SideNav me={me} />
        </Box>

        <Drawer isOpen={nav.isOpen} onClose={nav.onClose} placement={dir === 'rtl' ? 'right' : 'left'}>
          <DrawerOverlay />
          <DrawerContent bg={c.surface} maxW="260px">
            <DrawerBody p={0}><SideNav me={me} onNavigate={nav.onClose} /></DrawerBody>
          </DrawerContent>
        </Drawer>

        <Box flex="1" minW={0}>
          <Flex as="header" h="56px" px={{ base: 3, md: 5 }} align="center" gap={3} bg={c.surface} borderBottom="1px solid" borderColor={c.border} position="sticky" top={0} zIndex={10}>
            <IconButton aria-label="Menu" icon={<FiMenu />} size="sm" variant="ghost" display={{ base: 'inline-flex', lg: 'none' }} onClick={nav.onOpen} />
            <Box as="form" flex="1" maxW="560px" onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (q.trim().length >= 2) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }}>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none"><Icon as={FiSearch} color={c.faint} /></InputLeftElement>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search customers, transactions, references, addresses…')} borderRadius="8px" bg={c.surface2} border="1px solid" borderColor={c.border} />
              </InputGroup>
            </Box>
            <HStack spacing={1} ms="auto">
              {envBadge}
              <Button size="xs" variant="ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'English' : 'العربية'}</Button>
              <IconButton aria-label="Toggle colour mode" icon={colorMode === 'dark' ? <FiSun /> : <FiMoon />} size="sm" variant="ghost" onClick={toggleColorMode} />
              <Tooltip label={`${me.roles.join(', ')}${me.implicitSuperAdmin ? ' (implicit — assign explicit roles)' : ''}`} hasArrow>
                <Box textAlign="end" display={{ base: 'none', md: 'block' }} px={2}>
                  <Text fontSize="12px" fontWeight={600} lineHeight="1.2">{me.user.firstName} {me.user.lastName}</Text>
                  <Text fontSize="10px" color={c.muted} lineHeight="1.2">{me.roles.join(' · ')}</Text>
                </Box>
              </Tooltip>
              <IconButton aria-label={t('Sign out')} icon={<FiLogOut />} size="sm" variant="ghost" onClick={async () => { await logout(); router.replace('/admin/login'); }} />
            </HStack>
          </Flex>
          {me.implicitSuperAdmin ? (
            <Box px={5} py={2} bg={c.accentSoft} borderBottom="1px solid" borderColor={c.border}>
              <Text fontSize="xs" color={c.text}>Your account has no explicit staff roles and is treated as Super Admin for compatibility. Assign least-privilege roles in Staff & roles.</Text>
            </Box>
          ) : null}
          <Box as="main" px={{ base: 3, md: 6 }} py={5} maxW="1440px" mx="auto">{children}</Box>
        </Box>
      </Flex>
    </StaffContext.Provider>
  );
}
