'use client';
import { useState } from 'react';
import {
  Box, Text, Heading, Input, Select, VStack, HStack,
  Divider, Badge, useColorModeValue,
} from '@chakra-ui/react';

const DESTINATIONS = {
  Libya:          { wuPct: 0.059, bankFlat: 40, bankPct: 0.030, flag: '🇱🇾', note: 'avg Western Union rate' },
  Egypt:          { wuPct: 0.049, bankFlat: 35, bankPct: 0.025, flag: '🇪🇬', note: '' },
  UAE:            { wuPct: 0.039, bankFlat: 30, bankPct: 0.020, flag: '🇦🇪', note: '' },
  'Saudi Arabia': { wuPct: 0.039, bankFlat: 30, bankPct: 0.020, flag: '🇸🇦', note: '' },
} as const;

type Destination = keyof typeof DESTINATIONS;

function calcFee(amount: number, pct: number, flat = 0): number {
  return Math.max(flat + amount * pct, flat);
}

export default function FeeCalculator() {
  const [amount, setAmount] = useState(1000);
  const [dest, setDest] = useState<Destination>('Libya');

  const cfg = DESTINATIONS[dest];
  const promrktsFee = Math.max(amount * 0.005, 2);
  const wuFee       = calcFee(amount, cfg.wuPct);
  const bankFee     = cfg.bankFlat + amount * cfg.bankPct;
  const savings     = Math.max(wuFee - promrktsFee, 0);

  const bg      = useColorModeValue('#ffffff', '#0a0a0a');
  const border  = useColorModeValue('rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)');
  const surface = useColorModeValue('#f7f7f7', '#111111');
  const fg      = useColorModeValue('#000000', '#ffffff');
  const muted   = useColorModeValue('rgba(0,0,0,0.5)', 'rgba(255,255,255,0.5)');

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="24px"
      p={{ base: 6, md: 10 }}
      maxW="560px"
      mx="auto"
      boxShadow="0 24px 60px rgba(0,0,0,0.08)"
    >
      <VStack spacing={6} align="stretch">
        <VStack spacing={1} align="start">
          <Heading fontSize="22px" fontWeight="800" letterSpacing="-0.03em" color={fg}>
            How much do you save?
          </Heading>
          <Text fontSize="14px" color={muted}>
            Compare promrkts vs traditional transfer services
          </Text>
        </VStack>

        {/* Inputs */}
        <HStack spacing={3}>
          <Box flex={1}>
            <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" color={muted} mb={1.5} textTransform="uppercase">
              Amount (USD)
            </Text>
            <Input
              type="number"
              value={amount}
              min={10}
              max={100000}
              onChange={e => setAmount(Math.max(10, Number(e.target.value) || 0))}
              borderRadius="12px"
              border="1px solid"
              borderColor={border}
              bg={surface}
              color={fg}
              fontWeight="700"
              fontSize="18px"
              h="52px"
              px={4}
              _focus={{ outline: 'none', borderColor: fg }}
            />
          </Box>
          <Box flex={1}>
            <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" color={muted} mb={1.5} textTransform="uppercase">
              Send to
            </Text>
            <Select
              value={dest}
              onChange={e => setDest(e.target.value as Destination)}
              borderRadius="12px"
              border="1px solid"
              borderColor={border}
              bg={surface}
              color={fg}
              fontWeight="600"
              h="52px"
              _focus={{ outline: 'none', borderColor: fg }}
            >
              {Object.keys(DESTINATIONS).map(k => (
                <option key={k} value={k}>
                  {DESTINATIONS[k as Destination].flag} {k}
                </option>
              ))}
            </Select>
          </Box>
        </HStack>

        {/* Comparison table */}
        <VStack spacing={2} align="stretch">
          {/* promrkts row */}
          <HStack
            justify="space-between"
            bg={useColorModeValue('rgba(0,0,0,0.04)', 'rgba(255,255,255,0.06)')}
            border="2px solid"
            borderColor={fg}
            borderRadius="14px"
            px={4}
            py={3}
          >
            <HStack spacing={2}>
              <Text fontSize="15px" fontWeight="800" color={fg}>promrkts</Text>
              <Badge
                bg={fg} color={bg}
                borderRadius="6px" px={2} py={0.5}
                fontSize="10px" fontWeight="800" letterSpacing="0.05em"
              >
                BEST
              </Badge>
            </HStack>
            <Text fontSize="17px" fontWeight="800" color={fg}>
              ${promrktsFee.toFixed(2)}
            </Text>
          </HStack>

          {/* Western Union row */}
          <HStack justify="space-between" bg={surface} borderRadius="14px" px={4} py={3}>
            <Text fontSize="14px" fontWeight="600" color={muted}>Western Union</Text>
            <Text fontSize="15px" fontWeight="700" color={muted}>${wuFee.toFixed(2)}</Text>
          </HStack>

          {/* Bank wire row */}
          <HStack justify="space-between" bg={surface} borderRadius="14px" px={4} py={3}>
            <Text fontSize="14px" fontWeight="600" color={muted}>Bank wire (SWIFT)</Text>
            <Text fontSize="15px" fontWeight="700" color={muted}>${bankFee.toFixed(2)}</Text>
          </HStack>
        </VStack>

        <Divider borderColor={border} />

        {/* Savings callout */}
        <HStack justify="space-between" align="center">
          <Text fontSize="14px" fontWeight="600" color={muted}>You save vs Western Union</Text>
          <Text fontSize="22px" fontWeight="900" color={useColorModeValue('#16a34a', '#4ade80')} letterSpacing="-0.04em">
            ${savings.toFixed(2)}
          </Text>
        </HStack>

        <Text fontSize="12px" color={muted} textAlign="center">
          promrkts fee: 0.5% (min $2) · No hidden charges · Instant settlement
        </Text>
      </VStack>
    </Box>
  );
}
