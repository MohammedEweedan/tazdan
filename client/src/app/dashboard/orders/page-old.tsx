'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, Spinner, Flex, VStack, Select, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { orderAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function OrdersPage() {
  const { t } = useTranslate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await orderAPI.getAll(1, filter || undefined);
        setOrders(res.data.orders || []);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [filter]);

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('orders_title')}</Heading>

      <HStack mb={4}>
        <Select maxW="200px" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('common_filter')}>
          <option value="BUY">{t('trade_buy')}</option>
          <option value="SELL">{t('trade_sell')}</option>
        </Select>
      </HStack>

      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : orders.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>{t('orders_side')}</Th>
                <Th>{t('orders_amount')} (USDT)</Th>
                <Th>{t('orders_price')}</Th>
                <Th>{t('orders_total')}</Th>
                <Th>{t('trade_fee')}</Th>
                <Th>{t('orders_status')}</Th>
                <Th>{t('orders_date')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orders.map((o: any) => (
                <Tr key={o.id}>
                  <Td><Badge colorScheme={o.side === 'BUY' ? 'green' : 'red'}>{o.side === 'BUY' ? t('trade_buy') : t('trade_sell')}</Badge></Td>
                  <Td fontWeight="semibold">{formatCurrency(parseFloat(o.amount), 'USDT')}</Td>
                  <Td>{formatCurrency(parseFloat(o.price), o.quoteCurrency)}</Td>
                  <Td>{formatCurrency(parseFloat(o.total), o.quoteCurrency)}</Td>
                  <Td fontSize="xs">{formatCurrency(parseFloat(o.fee || '0'), 'USDT')}</Td>
                  <Td><Badge colorScheme="green">{o.status}</Badge></Td>
                  <Td fontSize="xs" color="subtle-text">{formatDate(o.createdAt)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
