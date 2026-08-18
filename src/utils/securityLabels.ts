import type { Security } from '../domain/types'

export type SecurityDisplayMode = 'symbol-first' | 'name-first' | 'name-only'

export const SECURITY_DISPLAY_MODE_KEY = 'equity-journal.security-display-mode'

export function loadSecurityDisplayMode():SecurityDisplayMode {
  const stored=localStorage.getItem(SECURITY_DISPLAY_MODE_KEY)
  return stored==='name-first'||stored==='name-only'?stored:'symbol-first'
}

export function formatSecurityLabel(security:Pick<Security,'symbol'|'name'>,mode:SecurityDisplayMode) {
  if(mode==='name-first')return `${security.name} — ${security.symbol}`
  if(mode==='name-only')return security.name
  return `${security.symbol} — ${security.name}`
}
