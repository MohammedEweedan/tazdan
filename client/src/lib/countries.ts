/**
 * ISO 3166-1 alpha-2 country list with E.164 dial codes and emoji flags.
 *
 * Ordered MENA-first (the platform's primary market) then alphabetical.
 * Mirror file lives at `mobile/src/data/countries.ts` — keep both in sync.
 *
 * `dialCode` is digits-only (no '+'), which is what the server expects
 * in `phoneCountryCode`.
 */
export interface Country {
  code: string;     // ISO-2 (e.g. "LY")
  name: string;
  dialCode: string; // digits only, e.g. "218"
  flag: string;     // emoji
}

const MENA: Country[] = [
  { code: 'LY', name: 'Libya',                 dialCode: '218', flag: '🇱🇾' },
  { code: 'AE', name: 'United Arab Emirates',  dialCode: '971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia',          dialCode: '966', flag: '🇸🇦' },
  { code: 'EG', name: 'Egypt',                 dialCode: '20',  flag: '🇪🇬' },
  { code: 'TN', name: 'Tunisia',               dialCode: '216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria',               dialCode: '213', flag: '🇩🇿' },
  { code: 'MA', name: 'Morocco',               dialCode: '212', flag: '🇲🇦' },
  { code: 'TR', name: 'Türkiye',               dialCode: '90',  flag: '🇹🇷' },
  { code: 'JO', name: 'Jordan',                dialCode: '962', flag: '🇯🇴' },
  { code: 'KW', name: 'Kuwait',                dialCode: '965', flag: '🇰🇼' },
  { code: 'QA', name: 'Qatar',                 dialCode: '974', flag: '🇶🇦' },
  { code: 'BH', name: 'Bahrain',               dialCode: '973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman',                  dialCode: '968', flag: '🇴🇲' },
  { code: 'LB', name: 'Lebanon',               dialCode: '961', flag: '🇱🇧' },
  { code: 'PS', name: 'Palestine',             dialCode: '970', flag: '🇵🇸' },
];

const REST: Country[] = [
  { code: 'US', name: 'United States',  dialCode: '1',   flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dialCode: '44',  flag: '🇬🇧' },
  { code: 'CA', name: 'Canada',         dialCode: '1',   flag: '🇨🇦' },
  { code: 'DE', name: 'Germany',        dialCode: '49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',         dialCode: '33',  flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',          dialCode: '39',  flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',          dialCode: '34',  flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands',    dialCode: '31',  flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium',        dialCode: '32',  flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland',    dialCode: '41',  flag: '🇨🇭' },
  { code: 'SE', name: 'Sweden',         dialCode: '46',  flag: '🇸🇪' },
  { code: 'NO', name: 'Norway',         dialCode: '47',  flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark',        dialCode: '45',  flag: '🇩🇰' },
  { code: 'FI', name: 'Finland',        dialCode: '358', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland',        dialCode: '353', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal',       dialCode: '351', flag: '🇵🇹' },
  { code: 'AT', name: 'Austria',        dialCode: '43',  flag: '🇦🇹' },
  { code: 'PL', name: 'Poland',         dialCode: '48',  flag: '🇵🇱' },
  { code: 'GR', name: 'Greece',         dialCode: '30',  flag: '🇬🇷' },
  { code: 'AU', name: 'Australia',      dialCode: '61',  flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand',    dialCode: '64',  flag: '🇳🇿' },
  { code: 'JP', name: 'Japan',          dialCode: '81',  flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea',    dialCode: '82',  flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore',      dialCode: '65',  flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong',      dialCode: '852', flag: '🇭🇰' },
  { code: 'IN', name: 'India',          dialCode: '91',  flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan',       dialCode: '92',  flag: '🇵🇰' },
  { code: 'ID', name: 'Indonesia',      dialCode: '62',  flag: '🇮🇩' },
  { code: 'MY', name: 'Malaysia',       dialCode: '60',  flag: '🇲🇾' },
  { code: 'PH', name: 'Philippines',    dialCode: '63',  flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand',       dialCode: '66',  flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam',        dialCode: '84',  flag: '🇻🇳' },
  { code: 'ZA', name: 'South Africa',   dialCode: '27',  flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria',        dialCode: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya',          dialCode: '254', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana',          dialCode: '233', flag: '🇬🇭' },
  { code: 'BR', name: 'Brazil',         dialCode: '55',  flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico',         dialCode: '52',  flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina',      dialCode: '54',  flag: '🇦🇷' },
  { code: 'CL', name: 'Chile',          dialCode: '56',  flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia',       dialCode: '57',  flag: '🇨🇴' },
];

REST.sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRIES: Country[] = [...MENA, ...REST];

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);
