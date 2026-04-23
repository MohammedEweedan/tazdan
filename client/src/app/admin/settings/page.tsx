'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Input, FormControl, FormLabel, Switch,
  useColorModeValue, useToast, VStack, SimpleGrid, Spinner, Flex, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';

export default function AdminSettingsPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadSettings = async () => {
    try {
      const res = await adminAPI.getSettings();
      const s = res.data.settings || [];
      setSettings(s);
      const vals: Record<string, string> = {};
      s.forEach((setting: any) => { vals[setting.key] = setting.value; });
      setEditValues(vals);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.updateSettings(editValues);
      toast({ title: t('common_success'), status: 'success' });
      loadSettings();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    } finally { setSaving(false); }
  };

  if (loading) return <Flex justify="center" py={20}><Spinner size="xl" color="brand.500" /></Flex>;

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_settings')}</Heading>

      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" p={6} maxW="2xl">
        <VStack spacing={4} align="stretch">
          {settings.map((s: any) => (
            <FormControl key={s.key}>
              <FormLabel fontSize="sm" textTransform="capitalize">{s.key.replace(/_/g, ' ')}</FormLabel>
              {s.value === 'true' || s.value === 'false' ? (
                <Switch
                  isChecked={editValues[s.key] === 'true'}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [s.key]: e.target.checked ? 'true' : 'false' }))}
                  colorScheme="brand"
                />
              ) : (
                <Input
                  value={editValues[s.key] || ''}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                />
              )}
              {s.description && <Text fontSize="xs" color="subtle-text" mt={1}>{s.description}</Text>}
            </FormControl>
          ))}
          <Button colorScheme="brand" isLoading={saving} onClick={handleSave}>{t('settings_save')}</Button>
        </VStack>
      </Box>
    </Box>
  );
}
