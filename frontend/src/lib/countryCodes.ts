// Simple country name -> code mapping (ISO3 where possible)
// NOTE: Can be expanded; minimal subset for demo.
export const COUNTRY_CODE_MAP: Record<string, string> = {
  'UNITED STATES': 'USA',
  'UNITED KINGDOM': 'GBR',
  'GREAT BRITAIN': 'GBR',
  'RUSSIA': 'RUS',
  'RUSSIAN FEDERATION': 'RUS',
  'CHINA': 'CHN',
  'PEOPLE\'S REPUBLIC OF CHINA': 'CHN',
  'FRANCE': 'FRA',
  'GERMANY': 'DEU',
  'SPAIN': 'ESP',
  'ITALY': 'ITA',
  'CANADA': 'CAN',
  'AUSTRALIA': 'AUS',
  'JAPAN': 'JPN',
  'SOUTH KOREA': 'KOR',
  'KOREA': 'KOR',
  'TURKEY': 'TUR',
  'TÜRKIYE': 'TUR',
  'TURKIYE': 'TUR',
  'KAZAKHSTAN': 'KAZ',
  'KYRGYZSTAN': 'KGZ',
  'UZBEKISTAN': 'UZB',
  'UKRAINE': 'UKR',
  'BELARUS': 'BLR',
  'NETHERLANDS': 'NLD',
  'SWEDEN': 'SWE',
  'NORWAY': 'NOR',
  'FINLAND': 'FIN',
  'POLAND': 'POL',
  'INDIA': 'IND',
  'BRAZIL': 'BRA',
  'ARGENTINA': 'ARG',
  'MEXICO': 'MEX',
  'SOUTH AFRICA': 'ZAF',
  'EGYPT': 'EGY'
}

// Try to normalize user input (supports already entered code)
export function toCountryCode(input: string): string | undefined {
  if (!input) return undefined
  const raw = input.trim().toUpperCase()
  // If already 2-3 letter code treat as code (basic heuristic)
  if (/^[A-Z]{2,3}$/.test(raw)) return raw
  return COUNTRY_CODE_MAP[raw]
}

// Reverse map code -> canonical name (first encountered name)
export const CODE_TO_NAME: Record<string, string> = Object.entries(COUNTRY_CODE_MAP)
  .reduce((acc, [name, code]) => { if (!acc[code]) acc[code] = name; return acc }, {} as Record<string,string>)

export interface CountryOption { code: string; name: string }

// Build unique options list
export const COUNTRY_OPTIONS: CountryOption[] = Array.from(
  Object.entries(CODE_TO_NAME),
  ([code, name]) => ({ code, name })
).sort((a,b)=>a.name.localeCompare(b.name))

// Fuzzy-ish search: match start of name or code contains
export function searchCountries(q: string, limit = 8): CountryOption[] {
  const query = q.trim().toUpperCase()
  if (!query) return COUNTRY_OPTIONS.slice(0, limit)
  const starts: CountryOption[] = []
  const contains: CountryOption[] = []
  for (const opt of COUNTRY_OPTIONS) {
    const nameU = opt.name.toUpperCase()
    if (nameU.startsWith(query) || opt.code.startsWith(query)) {
      starts.push(opt)
    } else if (nameU.includes(query)) {
      contains.push(opt)
    }
    if (starts.length >= limit) break
  }
  const pool = starts.concat(contains)
  return pool.slice(0, limit)
}

export function codeToDisplay(value: string): string {
  const upper = value.trim().toUpperCase()
  return CODE_TO_NAME[upper] || upper
}
