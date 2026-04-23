'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, Spinner, Flex, VStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AdminOrdersPage() {
  const { t } = useTranslate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminAPI.getOrders();
        setOrders(res.data.orders || []);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_orders')}</Heading>
      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : orders.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>{t('orders_side')}</Th>
                <Th>{t('orders_amount')}</Th>
                <Th>{t('orders_price')}</Th>
                <Th>{t('orders_total')}</Th>
                <Th>{t('orders_status')}</Th>
                <Th>{t('orders_date')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orders.map((o: any) => (
                <Tr key={o.id}>
                  <Td fontSize="sm">{o.user?.firstName} {o.user?.lastName}</Td>
                  <Td><Badge colorScheme={o.side === 'BUY' ? 'green' : 'red'}>{o.side}</Badge></Td>
                  <Td fontWeight="semibold">{formatCurrency(parseFloat(o.amount), 'USDT')}</Td>
                  <Td>{formatCurrency(parseFloat(o.price), o.quoteCurrency)}</Td>
                  <Td>{formatCurrency(parseFloat(o.total), o.quoteCurrency)}</Td>
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
