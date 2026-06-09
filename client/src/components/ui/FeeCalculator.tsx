'use client';
import { useState } from 'react';
import { useTranslate, useTolgee } from '@tolgee/react';
import {
  Box, Text, Heading, Input, Select, VStack, HStack,
  Divider, Badge, useColorMode,
} from '@chakra-ui/react';
import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import ar from 'i18n-iso-countries/langs/ar.json';
import fr from 'i18n-iso-countries/langs/fr.json';
import de from 'i18n-iso-countries/langs/de.json';
import es from 'i18n-iso-countries/langs/es.json';
import nl from 'i18n-iso-countries/langs/nl.json';
import ru from 'i18n-iso-countries/langs/ru.json';
import zh from 'i18n-iso-countries/langs/zh.json';

countries.registerLocale(en);
countries.registerLocale(ar);
countries.registerLocale(fr);
countries.registerLocale(de);
countries.registerLocale(es);
countries.registerLocale(nl);
countries.registerLocale(ru);
countries.registerLocale(zh);

const DEFAULT_FEES = {
  wuPct: 0.05,
  bankFlat: 35,
  bankPct: 0.025,
};

const CUSTOM_FEES: Record<string, Partial<typeof DEFAULT_FEES>> = {
  Libya:        { wuPct: 0.059, bankFlat: 40, bankPct: 0.030 },
  Egypt:        { wuPct: 0.049, bankFlat: 35, bankPct: 0.025 },
  'United Arab Emirates': { wuPct: 0.039, bankFlat: 30, bankPct: 0.020 },
  'Saudi Arabia':         { wuPct: 0.039, bankFlat: 30, bankPct: 0.020 },
  Turkey:       { wuPct: 0.044, bankFlat: 32, bankPct: 0.022 },
  Jordan:       { wuPct: 0.052, bankFlat: 38, bankPct: 0.028 },
  Morocco:      { wuPct: 0.047, bankFlat: 36, bankPct: 0.026 },
  Tunisia:      { wuPct: 0.051, bankFlat: 37, bankPct: 0.027 },
};

const countryCodeToFlag = (code: string) =>
  String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 127397 + c.charCodeAt(0))
  );

export const DESTINATIONS = Object.entries(
  countries.getNames('en', { select: 'official' })
)
  .map(([code, name]) => ({
    code,
    key: name,           // English name — used as the stable value
    flag: countryCodeToFlag(code),
    ...DEFAULT_FEES,
    ...CUSTOM_FEES[name],
  }))
  .sort((a, b) => a.key.localeCompare(b.key));

type DestKey = typeof DESTINATIONS[number]['key'];

/** Map Tolgee language codes to i18n-iso-countries locale codes */
const LANG_MAP: Record<string, string> = {
  en: 'en', ar: 'ar', fr: 'fr', de: 'de',
  es: 'es', nl: 'nl', ru: 'ru', cn: 'zh',
};

function calcFee(amount: number, pct: number, flat = 0): number {
  return Math.max(flat + amount * pct, flat);
}

export default function FeeCalculator() {
  const { t } = useTranslate();
  const tolgee = useTolgee(['language']);
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const isoLang = LANG_MAP[tolgee.getLanguage() ?? 'en'] ?? 'en';

  const [amount, setAmount] = useState(1000);
  const [destKey, setDestKey] = useState<DestKey>('Libya');

  const cfg = DESTINATIONS.find((d) => d.key === destKey)!;
  const tazdanFee = Math.max(amount * 0.005, 2);
  const wuFee       = calcFee(amount, cfg.wuPct);
  const bankFee     = cfg.bankFlat + amount * cfg.bankPct;
  const savings     = Math.max(wuFee - tazdanFee, 0);

  const bg      = dark ? '#0a0a0a' : '#ffffff';
  const border  = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const surface = dark ? '#111111' : '#f4f4f4';
  const fg      = dark ? '#ffffff' : '#000000';
  const muted   = dark ? 'rgba(255,255,255,0.50)' : 'rgba(0,0,0,0.50)';
  const highlightBorder = dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.7)';
  const savingsColor = dark ? '#4ade80' : '#16a34a';

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="24px"
      p={{ base: 6, md: 10 }}
      maxW="560px"
      mx="auto"
      boxShadow={dark ? '0 24px 60px rgba(0,0,0,0.4)' : '0 24px 60px rgba(0,0,0,0.08)'}
    >
      <VStack spacing={6} align="stretch">

        {/* Inputs */}
        <HStack spacing={3}>
          <Box flex={1}>
            <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" color={muted} mb={1.5} textTransform="uppercase">
              {t('calc_amount_label')}
            </Text>
            <Input
              type="number"
              value={amount}
              min={10}
              max={100000}
              onChange={(e) => setAmount(Math.max(10, Number(e.target.value) || 0))}
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
              {t('calc_send_to')}
            </Text>
            <Select
              value={destKey}
              onChange={(e) => setDestKey(e.target.value as DestKey)}
              borderRadius="12px"
              border="1px solid"
              borderColor={border}
              bg={surface}
              color={fg}
              fontWeight="600"
              h="52px"
              _focus={{ outline: 'none', borderColor: fg }}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.flag} {countries.getName(d.code, isoLang) ?? d.key}
                </option>
              ))}
            </Select>
          </Box>
        </HStack>

        {/* Comparison */}
        <VStack spacing={2} align="stretch">
          {/* tazdan */}
          <HStack
            justify="space-between"
            bg={dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
            border="2px solid"
            borderColor={highlightBorder}
            borderRadius="14px"
            px={4} py={3}
          >
            <HStack spacing={2}>
              <Text fontSize="15px" fontWeight="800" color={fg}>tazdan</Text>
              <Badge
                bg={fg} color={bg}
                borderRadius="6px" px={2} py={0.5}
                fontSize="10px" fontWeight="800" letterSpacing="0.05em"
              >
                {t('calc_best')}
              </Badge>
            </HStack>
            <Text fontSize="17px" fontWeight="800" color={fg}>
              ${tazdanFee.toFixed(2)}
            </Text>
          </HStack>

          {/* Western Union */}
          <HStack justify="space-between" bg={surface} borderRadius="14px" px={4} py={3}>
            <Text fontSize="14px" fontWeight="600" color={muted}>{t('calc_wu')}</Text>
            <Text fontSize="15px" fontWeight="700" color={muted}>${wuFee.toFixed(2)}</Text>
          </HStack>

          {/* Bank wire */}
          <HStack justify="space-between" bg={surface} borderRadius="14px" px={4} py={3}>
            <Text fontSize="14px" fontWeight="600" color={muted}>{t('calc_bank')}</Text>
            <Text fontSize="15px" fontWeight="700" color={muted}>${bankFee.toFixed(2)}</Text>
          </HStack>
        </VStack>

        <Divider borderColor={border} />

        {/* Savings */}
        <HStack justify="space-between" align="center">
          <Text fontSize="14px" fontWeight="600" color={muted}>{t('calc_savings')}</Text>
          <Text fontSize="22px" fontWeight="900" color={savingsColor} letterSpacing="-0.04em">
            ${savings.toFixed(2)}
          </Text>
        </HStack>

        <Text fontSize="12px" color={muted} textAlign="center">
          {t('calc_footer')}
        </Text>
      </VStack>
    </Box>
  );
}
