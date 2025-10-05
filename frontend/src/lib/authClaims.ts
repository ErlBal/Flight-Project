// Lightweight JWT claim decoder (no crypto verification; for UI hints only)
// Extracts company_ids if present.

export type DecodedToken = {
  exp?: number
  iat?: number
  sub?: string
  email?: string
  roles?: string[]
  company_ids?: number[]
  [k: string]: any
}

export function decodeToken(raw: string | null | undefined): DecodedToken | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length < 2) return null
  try {
    const json = atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getCompanyIdsFromToken(token: string | null | undefined): number[] | null {
  const decoded = decodeToken(token)
  if (!decoded) return null
  const ids = decoded.company_ids
  if (Array.isArray(ids)) return ids.filter(x => typeof x === 'number')
  return null
}
