'use client';

import { useEffect, useState } from 'react';
import {
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, useToast, Spinner, Flex, VStack, HStack,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function AdminKYCPage() {
  const { t } = useTranslate();
  const toast = useToast();
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const loadKYC = async () => {
    try {
      const res = await adminAPI.getKYC();
      setKycDocs(res.data.documents || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadKYC(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await adminAPI.approveKYC(id);
      else await adminAPI.rejectKYC(id);
      toast({ title: t('common_success'), status: 'success' });
      loadKYC();
    } catch (error: any) {
      toast({ title: error.response?.data?.error || t('common_error'), status: 'error' });
    }
  };

  return (
    <Box>
      <Heading size="lg" mb={6}>{t('admin_manage_kyc')}</Heading>
      <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="hidden">
        {loading ? (
          <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
        ) : kycDocs.length === 0 ? (
          <VStack py={10}><Text color="subtle-text">{t('common_no_data')}</Text></VStack>
        ) : (
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>User</Th>
                <Th>Document Type</Th>
                <Th>{t('orders_status')}</Th>
                <Th>{t('orders_date')}</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {kycDocs.map((doc: any) => (
                <Tr key={doc.id}>
                  <Td fontSize="sm">{doc.user?.firstName} {doc.user?.lastName}<br /><Text fontSize="xs" color="subtle-text">{doc.user?.email}</Text></Td>
                  <Td fontSize="sm">{doc.type}</Td>
                  <Td><Badge colorScheme={doc.status === 'APPROVED' ? 'green' : doc.status === 'PENDING' ? 'yellow' : 'red'}>{doc.status}</Badge></Td>
                  <Td fontSize="xs" color="subtle-text">{formatDate(doc.createdAt)}</Td>
                  <Td>
                    {doc.status === 'PENDING' && (
                      <HStack spacing={2}>
                        <Button size="xs" colorScheme="green" onClick={() => handleAction(doc.id, 'approve')}>{t('admin_approve')}</Button>
                        <Button size="xs" colorScheme="red" variant="outline" onClick={() => handleAction(doc.id, 'reject')}>{t('admin_reject')}</Button>
                      </HStack>
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
