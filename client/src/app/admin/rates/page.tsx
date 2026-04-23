'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Input, FormControl, FormLabel,
  SimpleGrid, useColorModeValue, useToast, VStack, Spinner, Flex, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI, exchangeAPI } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function AdminRatesPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { buyPrice: string; sellPrice: string }>>({});
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadRates = async () => {
    try {
      const res = await exchangeAPI.getRates();
      const r = res.data.rates || [];
      setRates(r);
      const vals: Record<string, { buyPrice: string; sellPrice: string }> = {};
      r.forEach((rate: any) => {
        vals[rate.id] = { buyPrice: rate.buyPrice, sellPrice: rate.sellPrice };
      });
      setEditValues(vals);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadRates(); }, []);

  const handleUpdate = async (id: string) => {
    setUpdating(id);
    try {
      const rate = rates.find((r: any) => r.id === id);
      if (!rate) return;
      const val = editValues[id];
      await adminAPI.updateRates(rate.baseCurrency, rate.quoteCurrency, {
        buyPrice: parseFloat(val.buyPrice),
        sellPrice: parseFloat(val.sellPrice),
      });
      toast({ title: t('common_success'), status: 'success' });
      loadRates();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setUpdating(null); }
  };

  if (loading) return <Flex justify="center" py={20}><Spinner size="xl" color="brand.500" /></Flex>;

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_exchange_rates')}</Heading>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        {rates.map((rate: any) => (
          <Box key={rate.id} bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6}>
            <Text fontSize="lg" fontWeight="bold" mb={4}>{rate.baseCurrency}/{rate.quoteCurrency}</Text>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel fontSize="sm">{t('admin_buy_price')}</FormLabel>
                <Input
                  type="number"
                  value={editValues[rate.id]?.buyPrice || ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [rate.id]: { ...prev[rate.id], buyPrice: e.target.value } }))}
                  step="any"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('admin_sell_price')}</FormLabel>
                <Input
                  type="number"
                  value={editValues[rate.id]?.sellPrice || ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [rate.id]: { ...prev[rate.id], sellPrice: e.target.value } }))}
                  step="any"
                />
              </FormControl>
              <HStack justify="space-between">
                <Text fontSize="xs" color="subtle-text">
                  Current: Buy {formatCurrency(parseFloat(rate.buyPrice), rate.quoteCurrency)} / Sell {formatCurrency(parseFloat(rate.sellPrice), rate.quoteCurrency)}
                </Text>
              </HStack>
              <Button colorScheme="brand" isLoading={updating === rate.id} onClick={() => handleUpdate(rate.id)}>
                {t('admin_update_rates')}
              </Button>
            </VStack>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  );
}
