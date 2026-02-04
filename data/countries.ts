/**
 * Countries Data with ISO codes, names, and default timezones
 * Used for CountrySelect component and timezone auto-detection
 */

export interface Country {
  code: string;      // ISO 3166-1 alpha-2 code
  name: string;      // English name
  flag: string;      // Emoji flag
  timezone: string;  // Primary/default timezone (IANA)
  phoneCode: string; // International dialing code
}

export const COUNTRIES: Country[] = [
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', timezone: 'Europe/Kyiv', phoneCode: '+380' },
  { code: 'US', name: 'United States', flag: '🇺🇸', timezone: 'America/New_York', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', timezone: 'Europe/London', phoneCode: '+44' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', timezone: 'America/Toronto', phoneCode: '+1' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', timezone: 'Australia/Sydney', phoneCode: '+61' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', timezone: 'Europe/Berlin', phoneCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', timezone: 'Europe/Paris', phoneCode: '+33' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', timezone: 'Europe/Madrid', phoneCode: '+34' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', timezone: 'Europe/Rome', phoneCode: '+39' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', timezone: 'Europe/Amsterdam', phoneCode: '+31' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', timezone: 'Europe/Brussels', phoneCode: '+32' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', timezone: 'Europe/Vienna', phoneCode: '+43' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', timezone: 'Europe/Zurich', phoneCode: '+41' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', timezone: 'Europe/Warsaw', phoneCode: '+48' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', timezone: 'Europe/Prague', phoneCode: '+420' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', timezone: 'Europe/Bratislava', phoneCode: '+421' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', timezone: 'Europe/Budapest', phoneCode: '+36' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', timezone: 'Europe/Bucharest', phoneCode: '+40' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', timezone: 'Europe/Sofia', phoneCode: '+359' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', timezone: 'Europe/Athens', phoneCode: '+30' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', timezone: 'Europe/Istanbul', phoneCode: '+90' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', timezone: 'Europe/Lisbon', phoneCode: '+351' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', timezone: 'Europe/Stockholm', phoneCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', timezone: 'Europe/Oslo', phoneCode: '+47' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', timezone: 'Europe/Copenhagen', phoneCode: '+45' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', timezone: 'Europe/Helsinki', phoneCode: '+358' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', timezone: 'Europe/Dublin', phoneCode: '+353' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', timezone: 'Europe/Vilnius', phoneCode: '+370' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', timezone: 'Europe/Riga', phoneCode: '+371' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', timezone: 'Europe/Tallinn', phoneCode: '+372' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩', timezone: 'Europe/Chisinau', phoneCode: '+373' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾', timezone: 'Europe/Minsk', phoneCode: '+375' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', timezone: 'Europe/Moscow', phoneCode: '+7' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', timezone: 'Asia/Tokyo', phoneCode: '+81' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', timezone: 'Asia/Seoul', phoneCode: '+82' },
  { code: 'CN', name: 'China', flag: '🇨🇳', timezone: 'Asia/Shanghai', phoneCode: '+86' },
  { code: 'IN', name: 'India', flag: '🇮🇳', timezone: 'Asia/Kolkata', phoneCode: '+91' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', timezone: 'Asia/Singapore', phoneCode: '+65' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', timezone: 'Asia/Bangkok', phoneCode: '+66' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', timezone: 'Asia/Ho_Chi_Minh', phoneCode: '+84' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', timezone: 'Asia/Kuala_Lumpur', phoneCode: '+60' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', timezone: 'Asia/Jakarta', phoneCode: '+62' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', timezone: 'Asia/Manila', phoneCode: '+63' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', timezone: 'Asia/Dubai', phoneCode: '+971' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', timezone: 'Asia/Riyadh', phoneCode: '+966' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', timezone: 'Asia/Jerusalem', phoneCode: '+972' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', timezone: 'Africa/Cairo', phoneCode: '+20' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', timezone: 'Africa/Johannesburg', phoneCode: '+27' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', timezone: 'Africa/Lagos', phoneCode: '+234' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', timezone: 'Africa/Nairobi', phoneCode: '+254' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', timezone: 'Africa/Casablanca', phoneCode: '+212' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', timezone: 'America/Sao_Paulo', phoneCode: '+55' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', timezone: 'America/Mexico_City', phoneCode: '+52' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', timezone: 'America/Argentina/Buenos_Aires', phoneCode: '+54' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', timezone: 'America/Santiago', phoneCode: '+56' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', timezone: 'America/Bogota', phoneCode: '+57' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', timezone: 'America/Lima', phoneCode: '+51' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', timezone: 'Pacific/Auckland', phoneCode: '+64' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪', timezone: 'Asia/Tbilisi', phoneCode: '+995' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲', timezone: 'Asia/Yerevan', phoneCode: '+374' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿', timezone: 'Asia/Baku', phoneCode: '+994' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿', timezone: 'Asia/Almaty', phoneCode: '+7' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿', timezone: 'Asia/Tashkent', phoneCode: '+998' },
];

// Sorted by name for dropdown display
export const COUNTRIES_SORTED = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

// Map for quick lookup by country code
export const COUNTRY_MAP = new Map(COUNTRIES.map(c => [c.code, c]));

/**
 * Get timezone for a country code
 */
export function getTimezoneForCountry(countryCode: string): string | null {
  const country = COUNTRY_MAP.get(countryCode.toUpperCase());
  return country?.timezone || null;
}

/**
 * Get country by code
 */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRY_MAP.get(code.toUpperCase());
}

/**
 * Common timezones list (for manual selection)
 */
export const COMMON_TIMEZONES = [
  // Europe
  'Europe/Kyiv',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'Europe/Istanbul',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'America/Mexico_City',
  // Asia/Pacific
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/**
 * Country to timezones mapping for countries with multiple timezones
 * Countries not in this map use their single default timezone from COUNTRIES
 */
export const COUNTRY_TIMEZONES: Record<string, string[]> = {
  US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'],
  CA: ['America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax', 'America/St_Johns'],
  RU: ['Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'],
  AU: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin'],
  BR: ['America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Fortaleza', 'America/Rio_Branco'],
  MX: ['America/Mexico_City', 'America/Cancun', 'America/Chihuahua', 'America/Tijuana'],
  CN: ['Asia/Shanghai', 'Asia/Urumqi'],
  ID: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  KZ: ['Asia/Almaty', 'Asia/Aqtobe'],
  PT: ['Europe/Lisbon', 'Atlantic/Azores'],
  ES: ['Europe/Madrid', 'Atlantic/Canary'],
  AR: ['America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza'],
  CL: ['America/Santiago', 'Pacific/Easter'],
  NZ: ['Pacific/Auckland', 'Pacific/Chatham'],
  UA: ['Europe/Kyiv'],
  GB: ['Europe/London'],
};

/**
 * All available timezones organized by region
 */
export const ALL_TIMEZONES = [
  'Europe/Kyiv', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Warsaw', 'Europe/Prague', 'Europe/Bratislava', 'Europe/Budapest', 'Europe/Bucharest', 'Europe/Sofia', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Lisbon', 'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Helsinki', 'Europe/Dublin', 'Europe/Vilnius', 'Europe/Riga', 'Europe/Tallinn', 'Europe/Chisinau', 'Europe/Minsk', 'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Atlantic/Azores', 'Atlantic/Canary',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Fortaleza', 'America/Rio_Branco', 'America/Mexico_City', 'America/Cancun', 'America/Chihuahua', 'America/Tijuana', 'America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza', 'America/Santiago', 'America/Bogota', 'America/Lima', 'Pacific/Easter',
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Urumqi', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Manila', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Jerusalem', 'Asia/Kolkata', 'Asia/Tbilisi', 'Asia/Yerevan', 'Asia/Baku', 'Asia/Almaty', 'Asia/Aqtobe', 'Asia/Tashkent', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Casablanca',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin', 'Pacific/Auckland', 'Pacific/Chatham',
];

/**
 * Get all timezones for a country
 */
export function getTimezonesForCountry(countryCode: string): string[] {
  const code = countryCode.toUpperCase();
  if (COUNTRY_TIMEZONES[code]) return COUNTRY_TIMEZONES[code];
  const country = COUNTRY_MAP.get(code);
  return country ? [country.timezone] : [];
}

/**
 * Timezone display info with UTC offset
 */
export interface TimezoneInfo {
  id: string;
  name: string;
  offset: string;
  offsetMinutes: number;
}

/**
 * Get timezone info with current UTC offset
 */
export function getTimezoneInfo(timezoneId: string): TimezoneInfo {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezoneId, timeZoneName: 'shortOffset' });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    const offset = offsetPart?.value || 'UTC';
    const testDate = new Date();
    const utcTime = testDate.getTime() + testDate.getTimezoneOffset() * 60000;
    const targetTime = new Date(utcTime).toLocaleString('en-US', { timeZone: timezoneId });
    const targetDate = new Date(targetTime);
    const offsetMinutes = Math.round((targetDate.getTime() - utcTime) / 60000);
    const name = timezoneId.replace(/_/g, ' ').replace(/\//g, ' / ').replace('America / Argentina / ', 'Argentina / ');
    return { id: timezoneId, name, offset, offsetMinutes };
  } catch {
    return { id: timezoneId, name: timezoneId.replace(/_/g, ' ').replace(/\//g, ' / '), offset: 'UTC', offsetMinutes: 0 };
  }
}
