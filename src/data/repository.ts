import type { ResearchTopic, ResearchTopicJournalEntry, ResearchTopicNote, ResearchTopicRelations, Security, SecurityJournalEntry, SecurityLinkTemplate, SecurityNote, Tag, TaggedSecurity, Taxonomy, Watchlist } from '../domain/types'

export type JournalEntryInput = Pick<SecurityJournalEntry, 'securityId' | 'entryDate' | 'contentHtml'> & { id?: string }
export type TopicJournalEntryInput = Pick<ResearchTopicJournalEntry, 'topicId' | 'entryDate' | 'contentHtml'> & { id?: string }
export type SecurityInput = Omit<Security, 'id' | 'alternativeId'> & { alternativeId?: string }

export interface EquityRepository {
  initialize(): Promise<void>
  listSecurities(watchlistId?: string): Promise<Security[]>
  addSecurity(input: SecurityInput): Promise<Security>
  updateSecurity(security: Security): Promise<void>
  deleteSecurity(id: string): Promise<void>
  listWatchlists(): Promise<Watchlist[]>
  addWatchlist(name: string): Promise<Watchlist>
  updateWatchlist(watchlist: Watchlist): Promise<void>
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
  listSecurityLinkTemplates(): Promise<SecurityLinkTemplate[]>
  saveSecurityLinkTemplates(templates: SecurityLinkTemplate[]): Promise<SecurityLinkTemplate[]>
  listResearchTopics(): Promise<ResearchTopic[]>
  addResearchTopic(title: string): Promise<ResearchTopic>
  updateResearchTopic(topic: Pick<ResearchTopic, 'id' | 'title'>): Promise<void>
  deleteResearchTopic(id: string): Promise<void>
  loadResearchTopicNote(topicId: string): Promise<ResearchTopicNote>
  saveResearchTopicNote(topicId: string, contentHtml: string): Promise<ResearchTopicNote>
  listResearchTopicJournalEntries(topicId: string): Promise<ResearchTopicJournalEntry[]>
  saveResearchTopicJournalEntry(input: TopicJournalEntryInput): Promise<ResearchTopicJournalEntry>
  deleteResearchTopicJournalEntry(id: string): Promise<void>
  getResearchTopicRelations(topicId: string): Promise<ResearchTopicRelations>
  setResearchTopicRelations(topicId: string, directSecurityIds: string[], tagIds: string[]): Promise<void>
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

export function cleanSecurityLinkTemplate(template: SecurityLinkTemplate, sortOrder: number): SecurityLinkTemplate {
  const linkText = cleanRequired(template.linkText, 'link text')
  const urlPattern = cleanRequired(template.urlPattern, 'a URL pattern')
  const placeholders = [...urlPattern.matchAll(/\{([^}]+)\}/g)].map((match) => match[1])
  if (!placeholders.length) throw new Error(`The URL pattern for “${linkText}” must contain {SYMBOL} or {ALTERNATIVE_ID}.`)
  if (placeholders.some((value) => value !== 'SYMBOL' && value !== 'ALTERNATIVE_ID')) throw new Error(`The URL pattern for “${linkText}” contains an unknown placeholder.`)
  try {
    const example = new URL(urlPattern.replaceAll('{SYMBOL}', 'AAPL').replaceAll('{ALTERNATIVE_ID}', 'US0378331005'))
    if (example.protocol !== 'https:' && example.protocol !== 'http:') throw new Error()
  } catch { throw new Error(`Enter a valid HTTP or HTTPS URL pattern for “${linkText}”.`) }
  return { ...template, linkText, urlPattern, sortOrder }
}

export function resolveSecurityLink(template: SecurityLinkTemplate, security: Security): string | null {
  if (template.urlPattern.includes('{ALTERNATIVE_ID}') && !security.alternativeId.trim()) return null
  return template.urlPattern.replaceAll('{SYMBOL}', encodeURIComponent(security.symbol)).replaceAll('{ALTERNATIVE_ID}', encodeURIComponent(security.alternativeId))
}

export function uuid(): string {
  return crypto.randomUUID()
}
