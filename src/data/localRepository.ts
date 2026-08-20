import type { ResearchTopic, ResearchTopicJournalEntry, ResearchTopicNote, Security, SecurityJournalEntry, SecurityLinkTemplate, SecurityNote, Tag, Taxonomy, Watchlist } from '../domain/types'
import { cleanJournalDate, cleanRequired, cleanSecurityLinkTemplate, type EquityRepository, type JournalEntryInput, type SecurityInput, type TopicJournalEntryInput, uuid } from './repository'

interface LocalData {
  securities: Security[]
  watchlists: Watchlist[]
  watchlistSecurities: Array<{ watchlistId: string; securityId: string }>
  taxonomies: Taxonomy[]
  tags: Tag[]
  securityTags: Array<{ securityId: string; tagId: string }>
  notes: SecurityNote[]
  journalEntries: SecurityJournalEntry[]
  securityLinkTemplates: SecurityLinkTemplate[]
  researchTopics: ResearchTopic[]
  researchTopicNotes: ResearchTopicNote[]
  researchTopicJournalEntries: ResearchTopicJournalEntry[]
  researchTopicSecurities: Array<{ topicId: string; securityId: string }>
  researchTopicTags: Array<{ topicId: string; tagId: string }>
}

const STORAGE_KEY = 'equity-journal.development-database.v1'
const emptyData = (): LocalData => ({
  securities: [], watchlists: [], watchlistSecurities: [], taxonomies: [], tags: [], securityTags: [], notes: [], journalEntries: [], securityLinkTemplates: [], researchTopics: [], researchTopicNotes: [], researchTopicJournalEntries: [], researchTopicSecurities: [], researchTopicTags: [],
})

export class LocalRepository implements EquityRepository {
  private data = emptyData()

  async initialize() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      this.data = { ...emptyData(), ...JSON.parse(stored) }
      this.data.securities = this.data.securities.map((security) => ({ ...security, alternativeId: security.alternativeId ?? '' }))
      if(this.data.watchlists.some((watchlist)=>watchlist.sortOrder===undefined))this.data.watchlists=this.data.watchlists.toSorted((left,right)=>left.name.localeCompare(right.name)).map((watchlist,sortOrder)=>({...watchlist,sortOrder}))
    }
  }

  private persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)) }
  private touchTopic(topicId: string, updatedAt = new Date().toISOString()) { const topic=this.data.researchTopics.find((item)=>item.id===topicId);if(topic)topic.updatedAt=updatedAt }
  private duplicate(items: Array<{ name: string }>, name: string, ignoredId?: string, ids?: Array<{ id: string }>) {
    const duplicateIndex = items.findIndex((item) => item.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)
    return duplicateIndex >= 0 && (!ignoredId || !ids || ids[duplicateIndex]?.id !== ignoredId)
  }

  async listSecurities(watchlistId?: string) {
    const ids = watchlistId ? new Set(this.data.watchlistSecurities.filter((x) => x.watchlistId === watchlistId).map((x) => x.securityId)) : null
    return this.data.securities.filter((x) => !ids || ids.has(x.id)).toSorted((a, b) => a.symbol.localeCompare(b.symbol))
  }
  async addSecurity(input: SecurityInput) {
    const security = { id: uuid(), symbol: cleanRequired(input.symbol, 'a symbol').toUpperCase(), alternativeId: input.alternativeId?.trim() ?? '', currency: cleanRequired(input.currency, 'a currency').toUpperCase(), name: cleanRequired(input.name, 'a company name') }
    if (this.data.securities.some((x) => x.symbol.toLowerCase() === security.symbol.toLowerCase())) throw new Error('A security with this symbol already exists.')
    this.data.securities.push(security); this.persist(); return security
  }
  async updateSecurity(security: Security) {
    const next = { ...security, symbol: cleanRequired(security.symbol, 'a symbol').toUpperCase(), alternativeId: security.alternativeId.trim(), currency: cleanRequired(security.currency, 'a currency').toUpperCase(), name: cleanRequired(security.name, 'a company name') }
    if (this.data.securities.some((x) => x.id !== next.id && x.symbol.toLowerCase() === next.symbol.toLowerCase())) throw new Error('A security with this symbol already exists.')
    this.data.securities = this.data.securities.map((x) => x.id === next.id ? next : x); this.persist()
  }
  async deleteSecurity(id: string) {
    this.data.securities = this.data.securities.filter((x) => x.id !== id)
    this.data.securityTags = this.data.securityTags.filter((x) => x.securityId !== id)
    this.data.watchlistSecurities = this.data.watchlistSecurities.filter((x) => x.securityId !== id)
    this.data.notes = this.data.notes.filter((x) => x.securityId !== id)
    this.data.journalEntries = this.data.journalEntries.filter((x) => x.securityId !== id)
    this.data.researchTopicSecurities = this.data.researchTopicSecurities.filter((x) => x.securityId !== id); this.persist()
  }
  async listWatchlists() { return this.data.watchlists.toSorted((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)) }
  async addWatchlist(value: string) {
    const name = cleanRequired(value, 'a watchlist name')
    if (this.data.watchlists.some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error('A watchlist with this name already exists.')
    const result = { id: uuid(), name, sortOrder:Math.max(-1,...this.data.watchlists.map((watchlist)=>watchlist.sortOrder))+1 }; this.data.watchlists.push(result); this.persist(); return result
  }
  async updateWatchlist(watchlist: Watchlist) {
    const name=cleanRequired(watchlist.name,'a watchlist name')
    if(this.data.watchlists.some((item)=>item.id!==watchlist.id&&item.name.toLowerCase()===name.toLowerCase()))throw new Error('A watchlist with this name already exists.')
    const existing=this.data.watchlists.find((item)=>item.id===watchlist.id)
    if(!existing)throw new Error('The watchlist no longer exists.')
    existing.name=name;this.persist()
  }
  async moveWatchlist(id:string,offset:-1|1) {
    const ordered=await this.listWatchlists(),index=ordered.findIndex((watchlist)=>watchlist.id===id),target=ordered[index+offset]
    if(index<0||!target)return
    const current=ordered[index],currentOrder=current.sortOrder
    current.sortOrder=target.sortOrder;target.sortOrder=currentOrder;this.persist()
  }
  async deleteWatchlist(id: string) {
    this.data.watchlists = this.data.watchlists.filter((watchlist) => watchlist.id !== id)
    this.data.watchlistSecurities = this.data.watchlistSecurities.filter((membership) => membership.watchlistId !== id)
    this.persist()
  }
  async setWatchlistSecurity(watchlistId: string, securityId: string, assigned: boolean) {
    this.data.watchlistSecurities = this.data.watchlistSecurities.filter((x) => x.watchlistId !== watchlistId || x.securityId !== securityId)
    if (assigned) this.data.watchlistSecurities.push({ watchlistId, securityId }); this.persist()
  }
  async listTaxonomies() { return this.data.taxonomies.toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) }
  async addTaxonomy(input: Pick<Taxonomy, 'name' | 'description' | 'color'>) {
    const name = cleanRequired(input.name, 'a taxonomy name')
    if (this.data.taxonomies.some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error('A taxonomy with this name already exists.')
    const result = { id: uuid(), name, description: input.description.trim(), color: input.color.toUpperCase(), sortOrder: this.data.taxonomies.length }
    this.data.taxonomies.push(result); this.persist(); return result
  }
  async deleteTaxonomy(id: string) {
    const tagIds = new Set(this.data.tags.filter((tag) => tag.taxonomyId === id).map((tag) => tag.id))
    this.data.taxonomies = this.data.taxonomies.filter((taxonomy) => taxonomy.id !== id)
    this.data.tags = this.data.tags.filter((tag) => tag.taxonomyId !== id)
    this.data.securityTags = this.data.securityTags.filter((assignment) => !tagIds.has(assignment.tagId))
    this.data.researchTopicTags = this.data.researchTopicTags.filter((assignment) => !tagIds.has(assignment.tagId))
    this.persist()
  }
  async listTags(taxonomyId: string) { return this.data.tags.filter((x) => x.taxonomyId === taxonomyId).toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)) }
  async listTaggedSecurities(taxonomyId: string) {
    const tagIds = new Set(this.data.tags.filter((tag) => tag.taxonomyId === taxonomyId).map((tag) => tag.id))
    return this.data.securityTags.flatMap((assignment) => {
      if (!tagIds.has(assignment.tagId)) return []
      const security = this.data.securities.find((item) => item.id === assignment.securityId)
      return security ? [{ ...security, tagId: assignment.tagId }] : []
    }).toSorted((left, right) => left.symbol.localeCompare(right.symbol) || left.id.localeCompare(right.id))
  }
  async copySecurityTag(securityId: string, toTagId: string) {
    if (!this.data.securityTags.some((assignment) => assignment.securityId === securityId && assignment.tagId === toTagId)) this.data.securityTags.push({ securityId, tagId: toTagId })
    this.persist()
  }
  async removeSecurityTag(securityId: string, tagId: string) {
    this.data.securityTags = this.data.securityTags.filter((assignment) => assignment.securityId !== securityId || assignment.tagId !== tagId)
    this.persist()
  }
  async moveSecurityTag(securityId: string, fromTagId: string, toTagId: string) {
    if (fromTagId === toTagId || !this.data.securityTags.some((assignment) => assignment.securityId === securityId && assignment.tagId === fromTagId)) return
    this.data.securityTags = this.data.securityTags.filter((assignment) => assignment.securityId !== securityId || assignment.tagId !== fromTagId)
    if (!this.data.securityTags.some((assignment) => assignment.securityId === securityId && assignment.tagId === toTagId)) this.data.securityTags.push({ securityId, tagId: toTagId })
    this.persist()
  }
  async addTag(input: Omit<Tag, 'id' | 'sortOrder'>) {
    const name = cleanRequired(input.name, 'a tag name')
    if (this.data.tags.some((x) => x.taxonomyId === input.taxonomyId && x.parentId === input.parentId && x.name.toLowerCase() === name.toLowerCase())) throw new Error('A tag with this name already exists at this level.')
    const siblings = this.data.tags.filter((x) => x.taxonomyId === input.taxonomyId && x.parentId === input.parentId)
    const result = { ...input, id: uuid(), name, description: input.description.trim(), color: input.color.toUpperCase(), sortOrder: siblings.length }
    this.data.tags.push(result); this.persist(); return result
  }
  async updateTag(tag: Pick<Tag, 'id' | 'taxonomyId' | 'name' | 'description' | 'color'>) {
    const existing = this.data.tags.find((x) => x.id === tag.id && x.taxonomyId === tag.taxonomyId)
    if (!existing) throw new Error('The selected tag no longer exists.')
    const name = cleanRequired(tag.name, 'a tag name')
    if (this.data.tags.some((x) => x.id !== tag.id && x.taxonomyId === tag.taxonomyId && x.parentId === existing.parentId && x.name.toLowerCase() === name.toLowerCase())) throw new Error('A tag with this name already exists at this level.')
    Object.assign(existing, { name, description: tag.description.trim(), color: tag.color.toUpperCase() }); this.persist()
  }
  async moveTag(tagId: string, parentId: string | null, index: number) {
    const tag = this.data.tags.find((item) => item.id === tagId)
    if (!tag) throw new Error('The selected tag no longer exists.')
    const parent = parentId ? this.data.tags.find((item) => item.id === parentId) : undefined
    if (parentId && (!parent || parent.taxonomyId !== tag.taxonomyId)) throw new Error('The destination tag no longer exists.')
    for (let ancestor = parent; ancestor; ancestor = ancestor.parentId ? this.data.tags.find((item) => item.id === ancestor!.parentId) : undefined) {
      if (ancestor.id === tagId) throw new Error('A tag cannot be moved inside itself or one of its descendants.')
    }
    if (this.data.tags.some((item) => item.id !== tagId && item.taxonomyId === tag.taxonomyId && item.parentId === parentId && item.name.toLowerCase() === tag.name.toLowerCase())) throw new Error('A tag with this name already exists at this level.')
    const oldParentId = tag.parentId
    const ordered = (parentValue: string | null) => this.data.tags.filter((item) => item.id !== tagId && item.taxonomyId === tag.taxonomyId && item.parentId === parentValue).toSorted((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    if (oldParentId !== parentId) ordered(oldParentId).forEach((item, position) => { item.sortOrder = position })
    const destination = ordered(parentId)
    destination.splice(Math.max(0, Math.min(index, destination.length)), 0, tag)
    tag.parentId = parentId
    destination.forEach((item, position) => { item.sortOrder = position })
    this.persist()
  }
  async deleteTag(taxonomyId: string, id: string) {
    if (this.data.tags.some((x) => x.parentId === id)) throw new Error('Delete the child tags first.')
    this.data.tags = this.data.tags.filter((x) => x.id !== id || x.taxonomyId !== taxonomyId)
    this.data.securityTags = this.data.securityTags.filter((x) => x.tagId !== id)
    this.data.researchTopicTags = this.data.researchTopicTags.filter((x) => x.tagId !== id); this.persist()
  }
  async assignedTagIds(securityId: string) { return this.data.securityTags.filter((x) => x.securityId === securityId).map((x) => x.tagId) }
  async setAssignedTags(securityId: string, tagIds: string[]) {
    this.data.securityTags = this.data.securityTags.filter((x) => x.securityId !== securityId)
    this.data.securityTags.push(...tagIds.map((tagId) => ({ securityId, tagId }))); this.persist()
  }
  async loadNote(securityId: string) { return this.data.notes.find((x) => x.securityId === securityId) ?? { securityId, contentHtml: '', updatedAt: '' } }
  async saveNote(securityId: string, contentHtml: string) {
    const result = { securityId, contentHtml, updatedAt: new Date().toISOString() }
    this.data.notes = this.data.notes.filter((x) => x.securityId !== securityId); this.data.notes.push(result); this.persist(); return result
  }
  async listJournalEntries(securityId: string) {
    return this.data.journalEntries.filter((entry) => entry.securityId === securityId).toSorted((left, right) => right.entryDate.localeCompare(left.entryDate) || right.updatedAt.localeCompare(left.updatedAt))
  }
  async saveJournalEntry(input: JournalEntryInput) {
    const entryDate = cleanJournalDate(input.entryDate)
    const duplicate = this.data.journalEntries.find((entry) => entry.securityId === input.securityId && entry.entryDate === entryDate && entry.id !== input.id)
    if (duplicate) throw new Error('A journal entry already exists for this date.')
    const existing = input.id ? this.data.journalEntries.find((entry) => entry.id === input.id) : undefined
    if (existing && existing.securityId !== input.securityId) throw new Error('The selected journal entry does not belong to this security.')
    const now = new Date().toISOString()
    const result: SecurityJournalEntry = { id: existing?.id ?? uuid(), securityId: input.securityId, entryDate, contentHtml: input.contentHtml, createdAt: existing?.createdAt ?? now, updatedAt: now }
    this.data.journalEntries = this.data.journalEntries.filter((entry) => entry.id !== result.id)
    this.data.journalEntries.push(result); this.persist(); return result
  }
  async deleteJournalEntry(id: string) {
    this.data.journalEntries = this.data.journalEntries.filter((entry) => entry.id !== id); this.persist()
  }
  async listSecurityLinkTemplates() { return this.data.securityLinkTemplates.toSorted((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)) }
  async saveSecurityLinkTemplates(templates: SecurityLinkTemplate[]) {
    const cleaned = templates.map(cleanSecurityLinkTemplate)
    this.data.securityLinkTemplates = cleaned; this.persist(); return cleaned
  }
  async listResearchTopics() { return this.data.researchTopics.toSorted((left,right)=>right.updatedAt.localeCompare(left.updatedAt)||left.title.localeCompare(right.title)) }
  async addResearchTopic(value:string) {
    const title=cleanRequired(value,'a topic title')
    if(this.data.researchTopics.some((topic)=>topic.title.toLowerCase()===title.toLowerCase()))throw new Error('A research topic with this title already exists.')
    const now=new Date().toISOString(),result={id:uuid(),title,createdAt:now,updatedAt:now}
    this.data.researchTopics.push(result);this.persist();return result
  }
  async updateResearchTopic(input:Pick<ResearchTopic,'id'|'title'>) {
    const topic=this.data.researchTopics.find((item)=>item.id===input.id)
    if(!topic)throw new Error('The selected research topic no longer exists.')
    const title=cleanRequired(input.title,'a topic title')
    if(this.data.researchTopics.some((item)=>item.id!==input.id&&item.title.toLowerCase()===title.toLowerCase()))throw new Error('A research topic with this title already exists.')
    topic.title=title;this.touchTopic(topic.id);this.persist()
  }
  async deleteResearchTopic(id:string) {
    this.data.researchTopics=this.data.researchTopics.filter((item)=>item.id!==id)
    this.data.researchTopicNotes=this.data.researchTopicNotes.filter((item)=>item.topicId!==id)
    this.data.researchTopicJournalEntries=this.data.researchTopicJournalEntries.filter((item)=>item.topicId!==id)
    this.data.researchTopicSecurities=this.data.researchTopicSecurities.filter((item)=>item.topicId!==id)
    this.data.researchTopicTags=this.data.researchTopicTags.filter((item)=>item.topicId!==id);this.persist()
  }
  async loadResearchTopicNote(topicId:string) { return this.data.researchTopicNotes.find((item)=>item.topicId===topicId)??{topicId,contentHtml:'',updatedAt:''} }
  async saveResearchTopicNote(topicId:string,contentHtml:string) {
    const result={topicId,contentHtml,updatedAt:new Date().toISOString()}
    this.data.researchTopicNotes=this.data.researchTopicNotes.filter((item)=>item.topicId!==topicId);this.data.researchTopicNotes.push(result);this.touchTopic(topicId,result.updatedAt);this.persist();return result
  }
  async listResearchTopicJournalEntries(topicId:string) { return this.data.researchTopicJournalEntries.filter((entry)=>entry.topicId===topicId).toSorted((left,right)=>right.entryDate.localeCompare(left.entryDate)||right.updatedAt.localeCompare(left.updatedAt)) }
  async saveResearchTopicJournalEntry(input:TopicJournalEntryInput) {
    const entryDate=cleanJournalDate(input.entryDate)
    if(this.data.researchTopicJournalEntries.some((entry)=>entry.topicId===input.topicId&&entry.entryDate===entryDate&&entry.id!==input.id))throw new Error('A journal entry already exists for this date.')
    const existing=input.id?this.data.researchTopicJournalEntries.find((entry)=>entry.id===input.id):undefined
    if(existing&&existing.topicId!==input.topicId)throw new Error('The selected journal entry does not belong to this research topic.')
    const now=new Date().toISOString(),result:ResearchTopicJournalEntry={id:existing?.id??uuid(),topicId:input.topicId,entryDate,contentHtml:input.contentHtml,createdAt:existing?.createdAt??now,updatedAt:now}
    this.data.researchTopicJournalEntries=this.data.researchTopicJournalEntries.filter((entry)=>entry.id!==result.id);this.data.researchTopicJournalEntries.push(result);this.touchTopic(input.topicId,now);this.persist();return result
  }
  async deleteResearchTopicJournalEntry(id:string) {
    const entry=this.data.researchTopicJournalEntries.find((item)=>item.id===id)
    this.data.researchTopicJournalEntries=this.data.researchTopicJournalEntries.filter((item)=>item.id!==id);if(entry)this.touchTopic(entry.topicId);this.persist()
  }
  async getResearchTopicRelations(topicId:string) {
    const directSecurityIds=this.data.researchTopicSecurities.filter((item)=>item.topicId===topicId).map((item)=>item.securityId)
    const tagIds=this.data.researchTopicTags.filter((item)=>item.topicId===topicId).map((item)=>item.tagId)
    const matchedTags=new Set(tagIds),queue=[...tagIds]
    while(queue.length){const parentId=queue.shift()!;for(const tag of this.data.tags)if(tag.parentId===parentId&&!matchedTags.has(tag.id)){matchedTags.add(tag.id);queue.push(tag.id)}}
    const dynamicIds=new Set(this.data.securityTags.filter((item)=>matchedTags.has(item.tagId)).map((item)=>item.securityId)),directIds=new Set(directSecurityIds)
    const relatedSecurities=this.data.securities.filter((security)=>directIds.has(security.id)||dynamicIds.has(security.id)).map((security)=>({...security,direct:directIds.has(security.id),dynamic:dynamicIds.has(security.id)})).toSorted((left,right)=>left.symbol.localeCompare(right.symbol))
    return{directSecurityIds,tagIds,relatedSecurities}
  }
  async setResearchTopicRelations(topicId:string,directSecurityIds:string[],tagIds:string[]) {
    this.data.researchTopicSecurities=this.data.researchTopicSecurities.filter((item)=>item.topicId!==topicId)
    this.data.researchTopicTags=this.data.researchTopicTags.filter((item)=>item.topicId!==topicId)
    this.data.researchTopicSecurities.push(...[...new Set(directSecurityIds)].map((securityId)=>({topicId,securityId})))
    this.data.researchTopicTags.push(...[...new Set(tagIds)].map((tagId)=>({topicId,tagId})))
    this.touchTopic(topicId);this.persist()
  }
}
