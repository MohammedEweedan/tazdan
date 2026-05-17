/**
 * AddBankAccountModal — production-ready secure form for adding bank accounts.
 * Implements security best practices:
 * - Input validation
 * - Account number masking in confirmation
 * - Confirmation step before saving
 * - Proper error handling
 * - Country, currency, sort code, IBAN, SWIFT support
 * - Country-specific bank fields
 * - Bank list per country
 */
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics, extractErrorMessage, useCountries } from '@/hooks';
import { bankAccountService } from '@/services';

type Step = 'form' | 'confirm' | 'countryPicker';

// Country-specific field requirements
const COUNTRY_FIELDS: Record<string, { sortCode?: boolean; iban?: boolean; routingNumber?: boolean; swift?: boolean }> = {
  GB: { sortCode: true, iban: false, routingNumber: false, swift: true },
  US: { sortCode: false, iban: false, routingNumber: true, swift: true },
  AE: { sortCode: false, iban: true, routingNumber: false, swift: true },
  SA: { sortCode: false, iban: true, routingNumber: false, swift: true },
  EG: { sortCode: false, iban: true, routingNumber: false, swift: true },
  FR: { sortCode: false, iban: true, routingNumber: false, swift: true },
  DE: { sortCode: false, iban: true, routingNumber: false, swift: true },
  ES: { sortCode: false, iban: true, routingNumber: false, swift: true },
  IT: { sortCode: false, iban: true, routingNumber: false, swift: true },
  NL: { sortCode: false, iban: true, routingNumber: false, swift: true },
  CA: { sortCode: false, iban: false, routingNumber: true, swift: true },
  AU: { sortCode: false, iban: false, routingNumber: true, swift: true },
};

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧' },
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', currency: 'AUD', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '🇩🇪' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', currency: 'EUR', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', currency: 'EUR', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', currency: 'EUR', flag: '🇦🇹' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', flag: '🇨🇭' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', flag: '🇪🇬' },
  { code: 'QA', name: 'Qatar', currency: 'QAR', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', currency: 'KWD', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman', currency: 'OMR', flag: '🇴🇲' },
  { code: 'IL', name: 'Israel', currency: 'ILS', flag: '🇮🇱' },
  { code: 'TR', name: 'Turkey', currency: 'TRY', flag: '🇹🇷' },
  { code: 'IN', name: 'India', currency: 'INR', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', currency: 'PKR', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', currency: 'BDT', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka', currency: 'LKR', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', currency: 'NPR', flag: '🇳🇵' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', flag: '���' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', flag: '🇸🇬' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', flag: '🇮🇩' },
  { code: 'TH', name: 'Thailand', currency: 'THB', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', currency: 'VND', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', flag: '🇵🇭' },
  { code: 'JP', name: 'Japan', currency: 'JPY', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', currency: 'KRW', flag: '🇰🇷' },
  { code: 'CN', name: 'China', currency: 'CNY', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD', flag: '🇹🇼' },
  { code: 'RU', name: 'Russia', currency: 'RUB', flag: '🇷🇺' },
  { code: 'BR', name: 'Brazil', currency: 'BRL', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', flag: '🇦🇷' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', currency: 'COP', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', currency: 'PEN', flag: '🇵🇪' },
  { code: 'CL', name: 'Chile', currency: 'CLP', flag: '🇨🇱' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'MA', name: 'Morocco', currency: 'MAD', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algeria', currency: 'DZD', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisia', currency: 'TND', flag: '🇹🇳' },
  { code: 'PL', name: 'Poland', currency: 'PLN', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', currency: 'HUF', flag: '🇭🇺' },
  { code: 'RO', name: 'Romania', currency: 'RON', flag: '🇷🇴' },
  { code: 'GR', name: 'Greece', currency: 'EUR', flag: '���' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', flag: '🇵🇹' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', currency: 'NOK', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', currency: 'DKK', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', currency: 'EUR', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', flag: '🇮🇪' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR', flag: '🇱🇺' },
  { code: 'IS', name: 'Iceland', currency: 'ISK', flag: '🇮🇸' },
  { code: 'UA', name: 'Ukraine', currency: 'UAH', flag: '🇺🇦' },
  { code: 'BY', name: 'Belarus', currency: 'BYN', flag: '🇧🇾' },
  { code: 'KZ', name: 'Kazakhstan', currency: 'KZT', flag: '🇰🇿' },
  { code: 'UZ', name: 'Uzbekistan', currency: 'UZS', flag: '🇺🇿' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', flag: '🇳🇿' },
  { code: 'JM', name: 'Jamaica', currency: 'JMD', flag: '🇯🇲' },
  { code: 'TT', name: 'Trinidad and Tobago', currency: 'TTD', flag: '🇹🇹' },
  { code: 'BB', name: 'Barbados', currency: 'BBD', flag: '🇧🇧' },
  { code: 'BS', name: 'Bahamas', currency: 'BSD', flag: '🇧🇸' },
  { code: 'PA', name: 'Panama', currency: 'PAB', flag: '🇵🇦' },
  { code: 'CR', name: 'Costa Rica', currency: 'CRC', flag: '🇨🇷' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', flag: '🇬🇹' },
  { code: 'SV', name: 'El Salvador', currency: 'USD', flag: '🇸🇻' },
  { code: 'HN', name: 'Honduras', currency: 'HNL', flag: '🇭🇳' },
  { code: 'NI', name: 'Nicaragua', currency: 'NIO', flag: '🇳🇮' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay', currency: 'UYU', flag: '🇺🇾' },
  { code: 'BO', name: 'Bolivia', currency: 'BOB', flag: '🇧🇴' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', flag: '🇪🇨' },
  { code: 'VE', name: 'Venezuela', currency: 'VES', flag: '🇻🇪' },
  { code: 'DO', name: 'Dominican Republic', currency: 'DOP', flag: '🇩🇴' },
  { code: 'PR', name: 'Puerto Rico', currency: 'USD', flag: '🇵🇷' },
  { code: 'CU', name: 'Cuba', currency: 'CUP', flag: '🇨🇺' },
  { code: 'HT', name: 'Haiti', currency: 'HTG', flag: '🇭🇹' },
  { code: 'GY', name: 'Guyana', currency: 'GYD', flag: '🇬🇾' },
  { code: 'SR', name: 'Suriname', currency: 'SRD', flag: '🇸🇷' },
  { code: 'LV', name: 'Latvia', currency: 'EUR', flag: '🇱🇻' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR', flag: '🇱🇹' },
  { code: 'EE', name: 'Estonia', currency: 'EUR', flag: '🇪🇪' },
  { code: 'BG', name: 'Bulgaria', currency: 'BGN', flag: '🇧🇬' },
  { code: 'HR', name: 'Croatia', currency: 'EUR', flag: '🇭🇷' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR', flag: '���' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR', flag: '🇸🇰' },
  { code: 'MK', name: 'North Macedonia', currency: 'MKD', flag: '🇲🇰' },
  { code: 'AL', name: 'Albania', currency: 'ALL', flag: '🇦🇱' },
  { code: 'RS', name: 'Serbia', currency: 'RSD', flag: '🇷🇸' },
  { code: 'ME', name: 'Montenegro', currency: 'EUR', flag: '🇲🇪' },
  { code: 'BA', name: 'Bosnia and Herzegovina', currency: 'BAM', flag: '🇧🇦' },
  { code: 'XK', name: 'Kosovo', currency: 'EUR', flag: '���' },
  { code: 'MD', name: 'Moldova', currency: 'MDL', flag: '🇲🇩' },
  { code: 'GE', name: 'Georgia', currency: 'GEL', flag: '🇬🇪' },
  { code: 'AM', name: 'Armenia', currency: 'AMD', flag: '🇦🇲' },
  { code: 'AZ', name: 'Azerbaijan', currency: 'AZN', flag: '🇦🇿' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR', flag: '🇨🇾' },
  { code: 'MT', name: 'Malta', currency: 'EUR', flag: '🇲🇹' },
  { code: 'MC', name: 'Monaco', currency: 'EUR', flag: '🇲🇨' },
  { code: 'AD', name: 'Andorra', currency: 'EUR', flag: '🇦🇩' },
  { code: 'SM', name: 'San Marino', currency: 'EUR', flag: '🇸🇲' },
  { code: 'VA', name: 'Vatican City', currency: 'EUR', flag: '🇻🇦' },
  { code: 'LI', name: 'Liechtenstein', currency: 'CHF', flag: '🇱🇮' },
  { code: 'JO', name: 'Jordan', currency: 'JOD', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', currency: 'LBP', flag: '🇱🇧' },
  { code: 'SY', name: 'Syria', currency: 'SYP', flag: '🇸🇾' },
  { code: 'IQ', name: 'Iraq', currency: 'IQD', flag: '🇮🇶' },
  { code: 'YE', name: 'Yemen', currency: 'YER', flag: '🇾🇪' },
  { code: 'AF', name: 'Afghanistan', currency: 'AFN', flag: '🇦🇫' },
  { code: 'IR', name: 'Iran', currency: 'IRR', flag: '🇮🇷' },
  { code: 'MV', name: 'Maldives', currency: 'MVR', flag: '🇲🇻' },
  { code: 'BT', name: 'Bhutan', currency: 'BTN', flag: '🇧🇹' },
  { code: 'MM', name: 'Myanmar', currency: 'MMK', flag: '🇲🇲' },
  { code: 'KH', name: 'Cambodia', currency: 'KHR', flag: '🇰🇭' },
  { code: 'LA', name: 'Laos', currency: 'LAK', flag: '🇱🇦' },
  { code: 'BN', name: 'Brunei', currency: 'BND', flag: '🇧🇳' },
  { code: 'FJ', name: 'Fiji', currency: 'FJD', flag: '🇫🇯' },
  { code: 'PG', name: 'Papua New Guinea', currency: 'PGK', flag: '🇵🇬' },
  { code: 'SB', name: 'Solomon Islands', currency: 'SBD', flag: '🇸🇧' },
  { code: 'VU', name: 'Vanuatu', currency: 'VUV', flag: '🇻🇺' },
  { code: 'WS', name: 'Samoa', currency: 'WST', flag: '🇼🇸' },
  { code: 'TO', name: 'Tonga', currency: 'TOP', flag: '🇹🇴' },
  { code: 'KI', name: 'Kiribati', currency: 'AUD', flag: '🇰🇮' },
  { code: 'FM', name: 'Micronesia', currency: 'USD', flag: '🇫🇲' },
  { code: 'MH', name: 'Marshall Islands', currency: 'USD', flag: '🇲🇭' },
  { code: 'PW', name: 'Palau', currency: 'USD', flag: '🇵🇼' },
  { code: 'NR', name: 'Nauru', currency: 'AUD', flag: '🇳🇷' },
  { code: 'TV', name: 'Tuvalu', currency: 'AUD', flag: '🇹🇻' },
  { code: 'MN', name: 'Mongolia', currency: 'MNT', flag: '🇲🇳' },
  { code: 'KP', name: 'North Korea', currency: 'KPW', flag: '🇰🇵' },
];

export function AddBankAccountModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const p = useThemedPalette();
  const t = useT();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>('form');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [branch, setBranch] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [iban, setIban] = useState('');
  const [swift, setSwift] = useState('');
  const [ctaState, setCta] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [ctaError, setCtaErr] = useState<string | null>(null);

  // Dynamic bank fetching
  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['banks', country],
    queryFn: () => bankAccountService.getBanksByCountry(country),
    enabled: country.length === 2,
  });

  // Dynamic country list (every country in the world via REST Countries
  // on the server). Falls back to the bundled static list when the API
  // hasn't responded yet — so the form is never blank.
  const { data: dynamicCountries } = useCountries();
  const allCountries = (dynamicCountries && dynamicCountries.length > 0)
    ? dynamicCountries.map((c) => ({
        code: c.cca2,
        name: c.name,
        currency: c.currencies?.[0] ?? 'USD',
        flag: c.flag,
      }))
    : COUNTRIES;

  // Auto-detect country from user profile
  useEffect(() => {
    const userCountry = (user as any)?.country;
    if (userCountry && allCountries.find((c) => c.code === userCountry)) {
      setCountry(userCountry);
      const countryData = allCountries.find((c) => c.code === userCountry);
      if (countryData) {
        setCurrency(countryData.currency);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dynamicCountries]);

  // Validation
  const bankNameValid = bankName.trim().length >= 2;
  const accountNumberValid = accountNumber.trim().length >= 8 && /^\d+$/.test(accountNumber.trim());
  const accountNameValid = accountName.trim().length >= 2 && /^[a-zA-Z\s\-']+$/.test(accountName.trim());
  const countryValid = country.length === 2;
  const currencyValid = currency.length >= 3;
  
  const countryFields = COUNTRY_FIELDS[country] || {};
  const sortCodeRequired = countryFields.sortCode;
  const ibanRequired = countryFields.iban;
  const routingNumberRequired = countryFields.routingNumber;
  const swiftRequired = countryFields.swift;

  const sortCodeValid = !sortCodeRequired || !sortCode || (/^\d{6}$/.test(sortCode.replace(/\s/g, '')));
  const routingNumberValid = !routingNumberRequired || !routingNumber || (/^\d{9}$/.test(routingNumber.replace(/\s/g, '')));
  const ibanValid = !ibanRequired || !iban || /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban.replace(/\s/g, '').toUpperCase());
  const swiftValid = !swiftRequired || !swift || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift.replace(/\s/g, '').toUpperCase());

  const formValid = bankNameValid && accountNumberValid && accountNameValid && countryValid && currencyValid &&
    (!sortCodeRequired || sortCodeValid) &&
    (!routingNumberRequired || routingNumberValid) &&
    (!ibanRequired || ibanValid) &&
    (!swiftRequired || swiftValid);

  // Mask account number for display (show only last 4 digits)
  const maskedAccountNumber = accountNumber.length > 4 ? `****${accountNumber.slice(-4)}` : accountNumber;
  const maskedIban = iban.length > 4 ? `****${iban.slice(-4)}` : iban;
  const maskedSortCode = sortCode.length > 2 ? `**${sortCode.slice(-2)}` : sortCode;
  const maskedRouting = routingNumber.length > 4 ? `****${routingNumber.slice(-4)}` : routingNumber;

  const onContinue = () => {
    if (!formValid) return;
    haptics.selection();
    setStep('confirm');
  };

  const onConfirm = async () => {
    if (!formValid) return;
    setCta('loading'); setCtaErr(null);
    try {
      await bankAccountService.add({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        branch: branch.trim() || undefined,
        country: country,
        currency: currency,
        sortCode: sortCode.trim() || undefined,
        routingNumber: routingNumber.trim() || undefined,
        iban: iban.trim() || undefined,
        swift: swift.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCta('success');
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCtaErr(extractErrorMessage(e, 'Failed to add bank account'));
      setCta('error');
      setTimeout(() => setCta('idle'), 2000);
    }
  };

  const onEdit = () => {
    haptics.selection();
    setStep('form');
  };

  const selectedCountry = allCountries.find((c) => c.code === country);
  const banksInCountry = banks;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
      {/* Header */}
      <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', marginBottom: 20 }}>
        {step === 'form' ? t('bankAccount.addTitle') : t('bankAccount.confirmTitle')}
      </Text>

      {step === 'form' ? (
        <>
          {/* Country Dropdown */}
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
            {t('bankAccount.country').toUpperCase()}
          </Text>
          <Pressable
            onPress={() => { haptics.selection(); setStep('countryPicker'); }}
            style={({ pressed }) => ({
              backgroundColor: p.bgElev,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: countryValid ? p.border : p.redFg,
              paddingHorizontal: 14,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {selectedCountry ? (
                <Text style={{ fontSize: 20 }}>{selectedCountry.flag}</Text>
              ) : (
                <Ionicons name="globe-outline" size={20} color={p.fgMuted} />
              )}
              <Text style={{ color: selectedCountry ? p.fg : p.fgMuted, fontSize: 16, fontWeight: '600' }}>
                {selectedCountry ? selectedCountry.name : 'Select country'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={p.fgMuted} />
          </Pressable>
          {!countryValid && (
            <Text style={{ color: p.redFg, fontSize: 12, marginTop: 4 }}>{t('bankAccount.invalidCountry')}</Text>
          )}

          {/* Bank Name with Dropdown */}
          {country && (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 }}>
                {t('bankAccount.bankName').toUpperCase()}
              </Text>
              {banksInCountry.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {banksInCountry.map((bank: string) => (
                      <Pressable
                        key={bank}
                        onPress={() => { haptics.selection(); setBankName(bank); }}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
                          backgroundColor: bankName === bank ? p.ctaBg : p.bgElev,
                          borderWidth: 1, borderColor: bankName === bank ? p.ctaBg : p.border,
                          opacity: pressed ? 0.85 : 1,
                        })}
                      >
                        <Text style={{ color: bankName === bank ? p.ctaFg : p.fg, fontWeight: '600', fontSize: 13 }}>
                          {bank}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => { haptics.selection(); setBankName(''); }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
                        backgroundColor: !bankName ? p.ctaBg : p.bgElev,
                        borderWidth: 1, borderColor: !bankName ? p.ctaBg : p.border,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text style={{ color: !bankName ? p.ctaFg : p.fg, fontWeight: '600', fontSize: 13 }}>
                        Other
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              ) : (
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: p.bgElev, borderRadius: 14,
                  borderWidth: 1, borderColor: bankName.trim().length > 0 && !bankNameValid ? p.redFg : p.border,
                  paddingHorizontal: 14, marginBottom: 16,
                }}>
                  <Ionicons name="business-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
                  <TextInput
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder={t('bankAccount.bankNamePlaceholder')}
                    placeholderTextColor={p.fgFaint}
                    autoCapitalize="words"
                    style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
                  />
                </View>
              )}
              {bankName && !bankNameValid && (
                <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidBankName')}</Text>
              )}
            </>
          )}

          {/* Account Name */}
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
            {t('bankAccount.accountName').toUpperCase()}
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: p.bgElev, borderRadius: 14,
            borderWidth: 1, borderColor: accountName.trim().length > 0 && !accountNameValid ? p.redFg : p.border,
            paddingHorizontal: 14, marginBottom: 16,
          }}>
            <Ionicons name="person-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
            <TextInput
              value={accountName}
              onChangeText={setAccountName}
              placeholder={t('bankAccount.accountNamePlaceholder')}
              placeholderTextColor={p.fgFaint}
              autoCapitalize="words"
              style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
            />
          </View>
          {accountName && !accountNameValid && (
            <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidAccountName')}</Text>
          )}

          {/* Account Number */}
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
            {t('bankAccount.accountNumber').toUpperCase()}
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: p.bgElev, borderRadius: 14,
            borderWidth: 1, borderColor: accountNumber.trim().length > 0 && !accountNumberValid ? p.redFg : p.border,
            paddingHorizontal: 14, marginBottom: 16,
          }}>
            <Ionicons name="card-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
            <TextInput
              value={accountNumber}
              onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ''))}
              placeholder={t('bankAccount.accountNumberPlaceholder')}
              placeholderTextColor={p.fgFaint}
              keyboardType="number-pad"
              maxLength={20}
              style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
            />
          </View>
          {accountNumber && !accountNumberValid && (
            <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidAccountNumber')}</Text>
          )}

          {/* Country-specific fields */}
          {sortCodeRequired && (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                {t('bankAccount.sortCode').toUpperCase()}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: p.bgElev, borderRadius: 14,
                borderWidth: 1, borderColor: sortCode && !sortCodeValid ? p.redFg : p.border,
                paddingHorizontal: 14, marginBottom: 16,
              }}>
                <Ionicons name="code-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={sortCode}
                  onChangeText={(v) => setSortCode(v.replace(/[^0-9]/g, ''))}
                  placeholder="00-00-00"
                  placeholderTextColor={p.fgFaint}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
                />
              </View>
              {sortCode && !sortCodeValid && (
                <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidSortCode')}</Text>
              )}
            </>
          )}

          {routingNumberRequired && (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                ROUTING NUMBER
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: p.bgElev, borderRadius: 14,
                borderWidth: 1, borderColor: routingNumber && !routingNumberValid ? p.redFg : p.border,
                paddingHorizontal: 14, marginBottom: 16,
              }}>
                <Ionicons name="swap-horizontal-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={routingNumber}
                  onChangeText={(v) => setRoutingNumber(v.replace(/[^0-9]/g, ''))}
                  placeholder="9-digit routing number"
                  placeholderTextColor={p.fgFaint}
                  keyboardType="number-pad"
                  maxLength={9}
                  style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
                />
              </View>
              {routingNumber && !routingNumberValid && (
                <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>Invalid routing number (9 digits)</Text>
              )}
            </>
          )}

          {ibanRequired && (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                {t('bankAccount.iban').toUpperCase()}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: p.bgElev, borderRadius: 14,
                borderWidth: 1, borderColor: iban && !ibanValid ? p.redFg : p.border,
                paddingHorizontal: 14, marginBottom: 16,
              }}>
                <Ionicons name="globe-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={iban}
                  onChangeText={(v) => setIban(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="GB00 WEST 1234 5678 90"
                  placeholderTextColor={p.fgFaint}
                  autoCapitalize="characters"
                  style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
                />
              </View>
              {iban && !ibanValid && (
                <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidIban')}</Text>
              )}
            </>
          )}

          {swiftRequired && (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
                {t('bankAccount.swift').toUpperCase()}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: p.bgElev, borderRadius: 14,
                borderWidth: 1, borderColor: swift && !swiftValid ? p.redFg : p.border,
                paddingHorizontal: 14, marginBottom: 16,
              }}>
                <Ionicons name="swap-horizontal-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
                <TextInput
                  value={swift}
                  onChangeText={(v) => setSwift(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="LOYDGB2LXXX"
                  placeholderTextColor={p.fgFaint}
                  autoCapitalize="characters"
                  style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
                />
              </View>
              {swift && !swiftValid && (
                <Text style={{ color: p.redFg, fontSize: 12, marginBottom: 8 }}>{t('bankAccount.invalidSwift')}</Text>
              )}
            </>
          )}

          {/* Branch (Optional) */}
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
            {t('bankAccount.branch').toUpperCase()} <Text style={{ color: p.fgFaint, fontSize: 10 }}>({t('common.optional')})</Text>
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: p.bgElev, borderRadius: 14,
            borderWidth: 1, borderColor: p.border,
            paddingHorizontal: 14, marginBottom: 20,
          }}>
            <Ionicons name="location-outline" size={18} color={p.fgMuted} style={{ marginRight: 10 }} />
            <TextInput
              value={branch}
              onChangeText={setBranch}
              placeholder={t('bankAccount.branchPlaceholder')}
              placeholderTextColor={p.fgFaint}
              autoCapitalize="words"
              style={{ flex: 1, color: p.fg, fontSize: 16, paddingVertical: 14 }}
            />
          </View>

          {/* Feedback */}
          {ctaState === 'error' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
              <Ionicons name="alert-circle-outline" size={16} color={p.redFg} />
              <Text style={{ color: p.redFg, fontSize: 13, flex: 1 }}>{ctaError}</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={onContinue}
            disabled={!formValid || ctaState === 'loading'}
            style={({ pressed }) => ({
              height: 56, borderRadius: 28,
              backgroundColor: formValid ? p.ctaBg : p.bgElev,
              borderWidth: formValid ? 0 : 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
              shadowColor: formValid ? p.ctaBg : 'transparent',
              shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
            })}
          >
            <Text style={{ color: formValid ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '800' }}>
              {t('common.continue')}
            </Text>
          </Pressable>
        </>
      ) : step === 'countryPicker' ? (
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgMuted, fontSize: 14, marginBottom: 16 }}>Select your country</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {allCountries.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => { haptics.selection(); setCountry(c.code); setCurrency(c.currency); setStep('form'); }}
                style={({ pressed }) => ({
                  backgroundColor: country === c.code ? p.ctaBg : p.bgElev,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>{c.flag}</Text>
                  <Text style={{ color: country === c.code ? p.ctaFg : p.fg, fontSize: 16, fontWeight: '600' }}>
                    {c.name}
                  </Text>
                </View>
                {country === c.code && (
                  <Ionicons name="checkmark-circle" size={20} color={p.ctaFg} />
                )}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => { haptics.selection(); setStep('form'); }}
            style={({ pressed }) => ({
              marginTop: 16,
              height: 48,
              borderRadius: 14,
              backgroundColor: p.bgElev,
              borderWidth: 1,
              borderColor: p.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Confirmation Screen */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', marginBottom: 12 }}>
              {t('bankAccount.reviewDetails')}
            </Text>

            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.country')}</Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{selectedCountry?.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.currency')}</Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{currency}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.bankName')}</Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{bankName}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.accountName')}</Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{accountName}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.accountNumber')}</Text>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{maskedAccountNumber}</Text>
              </View>
              {sortCode && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.sortCode')}</Text>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{maskedSortCode}</Text>
                </View>
              )}
              {routingNumber && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>Routing number</Text>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{maskedRouting}</Text>
                </View>
              )}
              {iban && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.iban')}</Text>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{maskedIban}</Text>
                </View>
              )}
              {swift && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.swift')}</Text>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{swift}</Text>
                </View>
              )}
              {branch && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('bankAccount.branch')}</Text>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{branch}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Security notice */}
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={p.ctaBg} />
            <Text style={{ color: p.fg, fontSize: 13, flex: 1 }}>
              {t('bankAccount.securityNotice')}
            </Text>
          </View>

          {/* Feedback */}
          {ctaState === 'error' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
              <Ionicons name="alert-circle-outline" size={16} color={p.redFg} />
              <Text style={{ color: p.redFg, fontSize: 13, flex: 1 }}>{ctaError}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={onConfirm}
              disabled={ctaState === 'loading'}
              style={({ pressed }) => ({
                height: 56, borderRadius: 28,
                backgroundColor: p.ctaBg,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
                opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
                shadowColor: p.ctaBg,
                shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
              })}
            >
              {ctaState === 'loading' ? (
                <ActivityIndicator color={p.ctaFg} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={17} color={p.ctaFg} />
                  <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '800' }}>{t('bankAccount.confirmAdd')}</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onEdit}
              disabled={ctaState === 'loading'}
              style={({ pressed }) => ({
                height: 56, borderRadius: 28,
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed || ctaState === 'loading' ? 0.85 : 1,
              })}
            >
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600' }}>{t('common.edit')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

export default AddBankAccountModal;
