'use client';

import { Suspense } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Box, Flex, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { ErrorBox, Loading, PageHeader, Panel, useCockpitColors } from '@/components/cockpit/ui';

function Results() {
  const q = useSearchParams()?.get('q') ?? '';
  const c = useCockpitColors();
  const { data, error, loading } = useApi<{ results: any[] }>(q.length >= 2 ? '/cockpit/search' : null, { q });
  return (
    <Box>
      <PageHeader title="Search" subtitle={q ? `Results for “${q}” across customers, businesses, money movements, addresses, devices, IPs, cases and audit` : 'Type at least two characters in the search bar'} />
      <ErrorBox error={error} />
      {loading ? <Loading /> : null}
      {data ? (
        <Panel pad={false}>
          {data.results.length === 0 ? <Text p={6} fontSize="sm" color={c.muted}>Nothing matched. Exact identifiers (references, hashes, addresses, IDs) and names, emails, handles and phone numbers are searched.</Text> : null}
          {data.results.map((r) => (
            <Flex key={`${r.kind}:${r.id}:${r.title}`} as={NextLink} href={r.href} px={4} py={3} gap={3} align="center" borderBottom="1px solid" borderColor={c.border} _hover={{ bg: c.surface2 }}>
              <Badge variant="outline" fontSize="10px" minW="86px" textAlign="center">{r.kind.replace('_', ' ')}</Badge>
              <Box minW={0}>
                <Text fontSize="13px" fontWeight={600} noOfLines={1}>{r.title}</Text>
                {r.subtitle ? <Text fontSize="12px" color={c.muted} noOfLines={1}>{r.subtitle}</Text> : null}
              </Box>
            </Flex>
          ))}
        </Panel>
      ) : null}
    </Box>
  );
}

export default function SearchPage() {
  return <Suspense fallback={null}><Results /></Suspense>;
}
