import type { Security, SecurityJournalEntry, SecurityNote, Tag, TaggedSecurity, Taxonomy, Watchlist } from '../domain/types'

export type JournalEntryInput = Pick<SecurityJournalEntry, 'securityId' | 'entryDate' | 'contentHtml'> & { id?: string }

export interface EquityRepository {
  initialize(): Promise<void>
  listSecurities(watchlistId?: string): Promise<Security[]>
  addSecurity(input: Omit<Security, 'id'>): Promise<Security>
  updateSecurity(security: Security): Promise<void>
  deleteSecurity(id: string): Promise<void>
  listWatchlists(): Promise<Watchlist[]>
  addWatchlist(name: string): Promise<Watchlist>
  deleteWatchlist(id: string): Promise<void>
  setWatchlistSecurity(watchlistId: string, securityId: string, assigned: boolean): Promise<void>
  listTaxonomies(): Promise<Taxonomy[]>
  addTaxonomy(input: Pick<Taxonomy, 'name' | 'description' | 'color'>): Promise<Taxonomy>
  deleteTaxonomy(id: string): Promise<void>
  listTags(taxonomyId: string): Promise<Tag[]>
  listTaggedSecurities(taxonomyId: string): Promise<TaggedSecurity[]>
  copySecurityTag(securityId: string, toTagId: string): Promise<void>
  removeSecurityTag(securityId: string, tagId: string): Promise<void>
  moveSecurityTag(securityId: string, fromTagId: string, toTagId: string): Promise<void>
  addTag(input: Omit<Tag, 'id' | 'sortOrder'>): Promise<Tag>
  updateTag(tag: Pick<Tag, 'id' | 'taxonomyId' | 'name' | 'description' | 'color'>): Promise<void>
  moveTag(tagId: string, parentId: string | null, index: number): Promise<void>
  deleteTag(taxonomyId: string, id: string): Promise<void>
  assignedTagIds(securityId: string): Promise<string[]>
  setAssignedTags(securityId: string, tagIds: string[]): Promise<void>
  loadNote(securityId: string): Promise<SecurityNote>
  saveNote(securityId: string, contentHtml: string): Promise<SecurityNote>
  listJournalEntries(securityId: string): Promise<SecurityJournalEntry[]>
  saveJournalEntry(input: JournalEntryInput): Promise<SecurityJournalEntry>
  deleteJournalEntry(id: string): Promise<void>
}

export function cleanRequired(value: string, label: string): string {
  const result = value.trim()
  if (!result) throw new Error(`Enter ${label}.`)
  return result
}

export function cleanJournalDate(value: string): string {
  const result = value.trim()
  const date = new Date(`${result}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== result) {
    throw new Error('Enter a valid journal date.')
  }
  return result
}

export function uuid(): string {
  return crypto.randomUUID()
}
