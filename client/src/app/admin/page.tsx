'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, SimpleGrid, Stat, StatLabel, StatNumber,
  Flex, Icon, Text, HStack, VStack, Badge, Button, useColorMode, Tabs, TabList, Tab,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import {
  FiUsers, FiArrowDownCircle, FiArrowUpCircle, FiShield, FiList,
  FiDollarSign, FiTrendingUp, FiActivity, FiClock, FiRepeat, FiBarChart2,
  FiChevronRight, FiAlertTriangle,
} from 'react-icons/fi';
import { adminAPI } from '@/lib/api';
import NextLink from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';

const fmt = (v: number) => {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString();
};
const fmtD = (v: any) => parseFloat(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function AdminDashboardPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dk = colorMode === 'dark';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const brand = '#0057b8';
  const cardBg = dk ? 'rgba(255,255,255,0.03)' : 'white';
  const cardBorder = dk ? 'rgba(255,255,255,0.07)' : 'rgba(0,87,184,0.1)';
  const textMain = dk ? 'white' : '#0f172a';
  const textSub = dk ? '#94a3b8' : '#64748b';
  const textMuted = dk ? '#475569' : '#94a3b8';
  const greenC = '#22c55e';
  const redC = '#ef4444';
  const amberC = '#f59e0b';
  const purpleC = '#8b5cf6';

  useEffect(() => {
    adminAPI.getDashboard().then((r: any) => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Flex minH="60vh" align="center" justify="center" direction="column" gap={4}>
        <Box w="32px" h="32px" borderRadius="full" border="2px solid" borderColor={brand} borderTopColor="transparent" style={{ animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Text fontSize="12px" color={textMuted} letterSpacing=".08em" textTransform="uppercase">Loading dashboard...</Text>
      </Flex>
    );
  }

  const s = stats || {};

  const metricCards = [
    { label: t('admin_total_users'), value: s.totalUsers || 0, sub: `${s.activeUsers || 0} active`, icon: FiUsers, color: brand, trend: `+${s.newUsersToday || 0} today` },
    { label: t('admin_pending_deposits'), value: s.pendingDeposits || 0, sub: 'Awaiting confirmation', icon: FiArrowDownCircle, color: amberC, alert: (s.pendingDeposits || 0) > 0 },
    { label: t('admin_pending_withdrawals'), value: s.pendingWithdrawals || 0, sub: 'Needs processing', icon: FiArrowUpCircle, color: redC, alert: (s.pendingWithdrawals || 0) > 0 },
    { label: t('admin_pending_kyc'), value: s.pendingKYC || 0, sub: 'Identity reviews', icon: FiShield, color: purpleC, alert: (s.pendingKYC || 0) > 0 },
    { label: t('admin_today_orders'), value: s.todayOrders || 0, sub: `${fmt(s.totalOrdersMonth || 0)} this month`, icon: FiList, color: greenC },
    { label: t('admin_total_revenue'), value: '$' + fmtD(s.totalFees), sub: `$${fmtD(s.todayFees)} today`, icon: FiDollarSign, color: '#0070e0' },
    { label: t('admin_today_volume'), value: '$' + fmtD(s.todayOrderVolume), sub: `$${fmtD(s.monthOrderVolume)} 30d`, icon: FiTrendingUp, color: brand },
    { label: t('admin_total_agents'), value: s.totalAgents || 0, sub: `${s.totalTransfers || 0} transfers`, icon: FiRepeat, color: '#06b6d4' },
  ];

  const userGrowth = (s.userGrowth || []).map((d: any) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const depositData = [
    { name: 'USD', value: parseFloat(s.totalDepositsUSD || 0), color: greenC },
    { name: 'USDT', value: parseFloat(s.totalDepositsUSDT || 0), color: '#26a17b' },
  ];

  const withdrawalData = [
    { name: 'USD', value: parseFloat(s.totalWithdrawalsUSD || 0), color: greenC },
    { name: 'USDT', value: parseFloat(s.totalWithdrawalsUSDT || 0), color: '#26a17b' },
  ];

  const buySellData = [
    { name: 'Buy', value: s.buyOrders || 0, color: brand },
    { name: 'Sell', value: s.sellOrders || 0, color: redC },
  ];

  return (
    <Box px={{ base: 4, lg: 6 }} py={6} maxW="1600px" mx="auto">
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg" fontWeight="900" letterSpacing="-.03em" color={textMain}>
            {t('admin_dashboard')}
          </Heading>
          <Text fontSize="13px" color={textSub} mt={1}>
            {t('admin_overview')} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </Box>
        <HStack spacing={2}>
          <Badge colorScheme="green" variant="subtle" px={2} py={1} borderRadius="6px" fontSize="10px">
            <HStack spacing={1}><Box w="6px" h="6px" borderRadius="full" bg={greenC} /><Text>System Healthy</Text></HStack>
          </Badge>
        </HStack>
      </Flex>

      {/* ── Alert Banner ── */}
      {((s.pendingDeposits || 0) + (s.pendingWithdrawals || 0) + (s.pendingKYC || 0)) > 0 && (
        <Flex
          mb={5} p={4} bg={dk ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'}
          border="1px solid" borderColor={dk ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)'}
          borderRadius="12px" align="center" gap={3}
        >
          <Icon as={FiAlertTriangle} color={amberC} boxSize={5} />
          <Text fontSize="13px" color={textMain} fontWeight="600" flex={1}>
            {s.pendingDeposits || 0} deposits, {s.pendingWithdrawals || 0} withdrawals, and {s.pendingKYC || 0} KYC reviews pending action
          </Text>
          <HStack spacing={2}>
            <Button as={NextLink} href="/admin/deposits" size="xs" variant="outline" borderColor={amberC} color={amberC} _hover={{ bg: amberC + '11' }}>
              Deposits
            </Button>
            <Button as={NextLink} href="/admin/withdrawals" size="xs" variant="outline" borderColor={amberC} color={amberC} _hover={{ bg: amberC + '11' }}>
              Withdrawals
            </Button>
          </HStack>
        </Flex>
      )}

      {/* ── Metric Cards ── */}
      <SimpleGrid columns={{ base: 2, md: 4, xl: 4 }} spacing={4} mb={6}>
        {metricCards.map((c, i) => (
          <Box key={i} p={5} bg={cardBg} border="1px solid" borderColor={c.alert ? amberC + '44' : cardBorder} borderRadius="14px"
            transition="all 0.15s" _hover={{ borderColor: c.color + '44', transform: 'translateY(-2px)', boxShadow: dk ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,87,184,0.08)' }}>
            <Flex justify="space-between" align="start" mb={3}>
              <Flex w="40px" h="40px" borderRadius="10px" bg={c.color + '14'} border="1px solid" borderColor={c.color + '22'} align="center" justify="center">
                <Icon as={c.icon} boxSize={4.5} color={c.color} />
              </Flex>
              {c.alert && <Box w="8px" h="8px" borderRadius="full" bg={amberC} style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />}
            </Flex>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            <Text fontSize="24px" fontWeight="900" color={textMain} letterSpacing="-.03em" mb={0.5}>{c.value}</Text>
            <Text fontSize="12px" fontWeight="700" color={textSub} mb={0.5}>{c.label}</Text>
            <Text fontSize="10px" color={textMuted}>{c.sub}</Text>
            {c.trend && <Text fontSize="10px" color={greenC} fontWeight="700" mt={1}>{c.trend}</Text>}
          </Box>
        ))}
      </SimpleGrid>

      {/* ── Charts Row ── */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5} mb={6}>
        {/* User Growth */}
        <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px">
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Text fontSize="14px" fontWeight="800" color={textMain}>{t('admin_user_growth')}</Text>
              <Text fontSize="11px" color={textSub}>New registrations per day</Text>
            </Box>
            <Badge bg={brand + '14'} color={brand} px={2} py={0.5} borderRadius="6px" fontSize="10px" fontWeight="700">
              +{s.newUsersWeek || 0} this week
            </Badge>
          </Flex>
          <Box h="220px">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="ugFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={brand} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dk ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: textSub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: textSub }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ReTooltip contentStyle={{ background: dk ? '#1e293b' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="count" stroke={brand} fill="url(#ugFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Volume Chart */}
        <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px">
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Text fontSize="14px" fontWeight="800" color={textMain}>{t('admin_volume_flow')}</Text>
              <Text fontSize="11px" color={textSub}>Deposits vs Withdrawals by currency</Text>
            </Box>
          </Flex>
          <Box h="220px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={['USD', 'USDT'].map(c => ({
                name: c,
                deposits: parseFloat(s[`totalDeposits${c}`] || 0),
                withdrawals: parseFloat(s[`totalWithdrawals${c}`] || 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={dk ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: textSub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: textSub }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} />
                <ReTooltip contentStyle={{ background: dk ? '#1e293b' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="deposits" fill={brand} radius={[4, 4, 0, 0]} name="Deposits" />
                <Bar dataKey="withdrawals" fill={redC} radius={[4, 4, 0, 0]} name="Withdrawals" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </SimpleGrid>

      {/* ── Bottom Row: Pie Charts + Tables ── */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={5} mb={6}>
        {/* Buy/Sell Ratio */}
        <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px">
          <Text fontSize="13px" fontWeight="800" color={textMain} mb={3}>Order Distribution</Text>
          <Box h="160px">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={buySellData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                  {buySellData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <ReTooltip contentStyle={{ background: dk ? '#1e293b' : 'white', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <HStack justify="center" spacing={4} mt={2}>
            {buySellData.map(d => (
              <HStack key={d.name} spacing={1.5}>
                <Box w="8px" h="8px" borderRadius="2px" bg={d.color} />
                <Text fontSize="11px" color={textSub} fontWeight="600">{d.name}: {d.value}</Text>
              </HStack>
            ))}
          </HStack>
        </Box>

        {/* Top Trading Pairs */}
        <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px">
          <Text fontSize="13px" fontWeight="800" color={textMain} mb={3}>{t('admin_top_pairs')}</Text>
          <VStack spacing={2} align="stretch">
            {(s.ordersByPair || []).slice(0, 5).map((p: any, i: number) => (
              <Flex key={i} justify="space-between" align="center" p={2} borderRadius="8px"
                bg={dk ? 'rgba(255,255,255,0.02)' : 'rgba(0,87,184,0.02)'}>
                <HStack spacing={2}>
                  <Text fontSize="12px" fontWeight="800" color={brand}>{i + 1}</Text>
                  <Text fontSize="12px" fontWeight="700" color={textMain}>{p.pair}</Text>
                </HStack>
                <VStack spacing={0} align="end">
                  <Text fontSize="11px" fontWeight="700" color={textMain}>{p.count} orders</Text>
                  <Text fontSize="10px" color={textSub}>${fmtD(p.volume)}</Text>
                </VStack>
              </Flex>
            ))}
            {(s.ordersByPair || []).length === 0 && <Text fontSize="12px" color={textMuted} textAlign="center" py={4}>No trading pairs yet</Text>}
          </VStack>
        </Box>

        {/* Recent Orders */}
        <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px" gridColumn={{ lg: 'span 2' }}>
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="13px" fontWeight="800" color={textMain}>{t('admin_recent_orders')}</Text>
            <Button as={NextLink} href="/admin/orders" variant="ghost" size="xs" rightIcon={<FiChevronRight />}
              color={textSub} fontSize="11px" fontWeight="600" _hover={{ color: brand }}>View All</Button>
          </Flex>
          <VStack spacing={0} align="stretch">
            {(s.recentOrders || []).slice(0, 6).map((o: any, i: number) => (
              <Flex key={o.id} justify="space-between" align="center" py={2} px={1}
                borderBottom={i < Math.min((s.recentOrders || []).length, 6) - 1 ? '1px solid' : 'none'}
                borderColor={cardBorder}>
                <HStack spacing={3}>
                  <Badge colorScheme={o.side === 'BUY' ? 'blue' : 'red'} variant="subtle" fontSize="9px" px={1.5} borderRadius="4px">
                    {o.side}
                  </Badge>
                  <Box>
                    <Text fontSize="12px" fontWeight="700" color={textMain}>
                      {o.user?.firstName || ''} {o.user?.lastName || ''}
                    </Text>
                    <Text fontSize="10px" color={textSub}>{o.user?.email}</Text>
                  </Box>
                </HStack>
                <VStack spacing={0} align="end">
                  <Text fontSize="12px" fontWeight="700" color={textMain}>
                    {parseFloat(o.amount || 0).toFixed(2)} {o.baseCurrency}
                  </Text>
                  <Text fontSize="10px" color={textSub}>
                    {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </VStack>
              </Flex>
            ))}
            {(s.recentOrders || []).length === 0 && <Text fontSize="12px" color={textMuted} textAlign="center" py={6}>No orders yet</Text>}
          </VStack>
        </Box>
      </SimpleGrid>

      {/* ── Quick Actions ── */}
      <Box p={5} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="14px">
        <Text fontSize="13px" fontWeight="800" color={textMain} mb={4}>{t('admin_quick_actions')}</Text>
        <SimpleGrid columns={{ base: 2, md: 4, lg: 8 }} spacing={3}>
          {[
            { href: '/admin/deposits', icon: FiArrowDownCircle, label: t('admin_manage_deposits'), color: amberC },
            { href: '/admin/withdrawals', icon: FiArrowUpCircle, label: t('admin_manage_withdrawals'), color: redC },
            { href: '/admin/kyc', icon: FiShield, label: t('admin_manage_kyc'), color: purpleC },
            { href: '/admin/users', icon: FiUsers, label: t('admin_manage_users'), color: brand },
            { href: '/admin/orders', icon: FiList, label: t('admin_orders'), color: greenC },
            { href: '/admin/rates', icon: FiTrendingUp, label: t('admin_exchange_rates'), color: '#0070e0' },
            { href: '/admin/settings', icon: FiActivity, label: t('admin_settings'), color: '#06b6d4' },
          ].map(a => (
            <VStack key={a.href} as={NextLink} href={a.href} spacing={2} p={3} borderRadius="12px" border="1px solid"
              borderColor={cardBorder} bg="transparent"
              _hover={{ borderColor: a.color + '44', transform: 'translateY(-2px)', boxShadow: dk ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,87,184,0.06)' }}
              transition="all 0.2s" cursor="pointer">
              <Flex w={9} h={9} borderRadius="10px" align="center" justify="center" bg={a.color + '14'} border="1px solid" borderColor={a.color + '22'}>
                <Icon as={a.icon} boxSize={4} color={a.color} />
              </Flex>
              <Text fontSize="10px" fontWeight="700" color={textMain} textAlign="center" lineHeight="1.3">{a.label}</Text>
            </VStack>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
