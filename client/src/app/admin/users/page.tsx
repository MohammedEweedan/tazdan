'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, useToast, Spinner, Flex, VStack, Select, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminUsersPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadUsers = async () => {
    try {
      const res = await adminAPI.getUsers();
      setUsers(res.data.users || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await adminAPI.updateUserStatus(userId, status);
      toast({ title: t('common_success'), status: 'success' });
      loadUsers();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    }
  };

  const statusColor = (s: string) => s === 'ACTIVE' ? 'green' : s === 'SUSPENDED' ? 'yellow' : 'red';
  const kycColor = (s: string) => s === 'APPROVED' ? 'green' : s === 'PENDING' ? 'yellow' : s === 'REJECTED' ? 'red' : 'gray';

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_manage_users')}</Heading>
      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : users.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>{t('auth_email')}</Th>
                <Th>Role</Th>
                <Th>KYC</Th>
                <Th>{t('orders_status')}</Th>
                <Th>Joined</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((u: any) => (
                <Tr key={u.id}>
                  <Td fontSize="sm" fontWeight="medium">{u.firstName} {u.lastName}</Td>
                  <Td fontSize="sm">{u.email}</Td>
                  <Td><Badge colorScheme={u.role === 'ADMIN' ? 'purple' : 'blue'}>{u.role}</Badge></Td>
                  <Td><Badge colorScheme={kycColor(u.kycStatus)}>{u.kycStatus}</Badge></Td>
                  <Td><Badge colorScheme={statusColor(u.status)}>{u.status}</Badge></Td>
                  <Td fontSize="xs" color="subtle-text">{formatDate(u.createdAt)}</Td>
                  <Td>
                    {u.role !== 'ADMIN' && (
                      <Select size="xs" w="120px" value={u.status} onChange={(e) => handleStatusChange(u.id, e.target.value)}>
                        <option value="ACTIVE">{t('common_status_active')}</option>
                        <option value="SUSPENDED">{t('common_status_suspended')}</option>
                        <option value="BANNED">{t('common_status_banned')}</option>
                      </Select>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
