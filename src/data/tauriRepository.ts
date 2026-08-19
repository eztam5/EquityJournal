import Database from '@tauri-apps/plugin-sql'
import type { ResearchTopic, ResearchTopicJournalEntry, ResearchTopicNote, Security, SecurityJournalEntry, SecurityLinkTemplate, SecurityNote, Tag, TaggedSecurity, Taxonomy, Watchlist } from '../domain/types'
import { cleanJournalDate, cleanRequired, cleanSecurityLinkTemplate, type EquityRepository, type JournalEntryInput, type SecurityInput, type TopicJournalEntryInput, uuid } from './repository'

type DbRow = Record<string, string | number | null>
const mapSecurity = (row: DbRow): Security => ({ id:String(row.id),name:String(row.name),symbol:String(row.symbol),alternativeId:String(row.alternative_id ?? ''),currency:String(row.currency) })

export class TauriRepository implements EquityRepository {
  private db!: Database
  async initialize() {
    this.db = await Database.load('sqlite:equity-journal.sqlite3')
    await this.db.execute('PRAGMA foreign_keys = ON')
  }
  async listSecurities(watchlistId?: string): Promise<Security[]> {
    if (watchlistId) return (await this.db.select<DbRow[]>('SELECT s.id,s.name,s.symbol,s.alternative_id,s.currency FROM securities s JOIN watchlist_securities ws ON ws.security_id=s.id WHERE ws.watchlist_id=$1 ORDER BY lower(s.symbol),s.id', [watchlistId])).map(mapSecurity)
    return (await this.db.select<DbRow[]>('SELECT id,name,symbol,alternative_id,currency FROM securities ORDER BY lower(symbol),id')).map(mapSecurity)
  }
  async addSecurity(input: SecurityInput) {
    const result = { id: uuid(), name: cleanRequired(input.name, 'a company name'), symbol: cleanRequired(input.symbol, 'a symbol').toUpperCase(), alternativeId: input.alternativeId?.trim() ?? '', currency: cleanRequired(input.currency, 'a currency').toUpperCase() }
    try { await this.db.execute('INSERT INTO securities (id,name,symbol,alternative_id,currency) VALUES ($1,$2,$3,$4,$5)', [result.id,result.name,result.symbol,result.alternativeId,result.currency]) }
    catch { throw new Error('A security with this symbol already exists.') }
    return result
  }
  async updateSecurity(s: Security) {
    const name = cleanRequired(s.name, 'a company name'), symbol = cleanRequired(s.symbol, 'a symbol').toUpperCase(), alternativeId=s.alternativeId.trim(), currency = cleanRequired(s.currency, 'a currency').toUpperCase()
    try { await this.db.execute('UPDATE securities SET name=$1,symbol=$2,alternative_id=$3,currency=$4 WHERE id=$5', [name,symbol,alternativeId,currency,s.id]) }
    catch { throw new Error('A security with this symbol already exists.') }
  }
  async deleteSecurity(id: string) { await this.db.execute('DELETE FROM securities WHERE id=$1', [id]) }
  async listWatchlists(): Promise<Watchlist[]> { return this.db.select('SELECT id,name FROM watchlists ORDER BY lower(name),id') }
  async addWatchlist(value: string) {
    const result = { id: uuid(), name: cleanRequired(value, 'a watchlist name') }
    try { await this.db.execute('INSERT INTO watchlists (id,name) VALUES ($1,$2)', [result.id, result.name]) }
    catch { throw new Error('A watchlist with this name already exists.') }
    return result
  }
  async deleteWatchlist(id: string) { await this.db.execute('DELETE FROM watchlists WHERE id=$1', [id]) }
  async setWatchlistSecurity(watchlistId: string, securityId: string, assigned: boolean) {
    if (assigned) await this.db.execute('INSERT OR IGNORE INTO watchlist_securities (watchlist_id,security_id) VALUES ($1,$2)', [watchlistId, securityId])
    else await this.db.execute('DELETE FROM watchlist_securities WHERE watchlist_id=$1 AND security_id=$2', [watchlistId, securityId])
  }
  async listTaxonomies(): Promise<Taxonomy[]> {
    const rows = await this.db.select<DbRow[]>('SELECT id,name,COALESCE(description,\'\') description,color,sort_order FROM taxonomies WHERE archived_at IS NULL ORDER BY sort_order,lower(name),id')
    return rows.map((x) => ({ id: String(x.id), name: String(x.name), description: String(x.description), color: String(x.color), sortOrder: Number(x.sort_order) }))
  }
  async addTaxonomy(input: Pick<Taxonomy, 'name' | 'description' | 'color'>) {
    const rows = await this.db.select<Array<{ next_order: number }>>('SELECT COALESCE(MAX(sort_order),-1)+1 next_order FROM taxonomies')
    const result = { id: uuid(), name: cleanRequired(input.name, 'a taxonomy name'), description: input.description.trim(), color: input.color.toUpperCase(), sortOrder: rows[0]?.next_order ?? 0 }
    try { await this.db.execute('INSERT INTO taxonomies (id,name,description,color,sort_order) VALUES ($1,$2,$3,$4,$5)', [result.id,result.name,result.description,result.color,result.sortOrder]) }
    catch { throw new Error('A taxonomy with this name already exists.') }
    return result
  }
  async deleteTaxonomy(id: string) {
    await this.db.execute('DELETE FROM taxonomies WHERE id=$1', [id])
  }
  async listTags(taxonomyId: string): Promise<Tag[]> {
    const rows = await this.db.select<DbRow[]>('SELECT id,taxonomy_id,parent_id,name,COALESCE(description,\'\') description,COALESCE(color,\'\') color,sort_order FROM tags WHERE taxonomy_id=$1 AND archived_at IS NULL ORDER BY sort_order,lower(name),id', [taxonomyId])
    return rows.map((x) => ({ id:String(x.id),taxonomyId:String(x.taxonomy_id),parentId:x.parent_id ? String(x.parent_id):null,name:String(x.name),description:String(x.description),color:String(x.color),sortOrder:Number(x.sort_order) }))
  }
  async listTaggedSecurities(taxonomyId: string): Promise<TaggedSecurity[]> {
    const rows = await this.db.select<DbRow[]>('SELECT st.tag_id,s.id,s.name,s.symbol,s.alternative_id,s.currency FROM security_tags st JOIN tags t ON t.id=st.tag_id JOIN securities s ON s.id=st.security_id WHERE t.taxonomy_id=$1 AND t.archived_at IS NULL ORDER BY lower(s.symbol),s.id', [taxonomyId])
    return rows.map((row) => ({ ...mapSecurity(row), tagId:String(row.tag_id) }))
  }
  async copySecurityTag(securityId: string, toTagId: string) {
    await this.db.execute('INSERT OR IGNORE INTO security_tags (security_id,tag_id) VALUES ($1,$2)', [securityId,toTagId])
  }
  async removeSecurityTag(securityId: string, tagId: string) {
    await this.db.execute('DELETE FROM security_tags WHERE security_id=$1 AND tag_id=$2', [securityId,tagId])
  }
  async moveSecurityTag(securityId: string, fromTagId: string, toTagId: string) {
    if (fromTagId === toTagId) return
    await this.db.execute('INSERT OR IGNORE INTO security_tags (security_id,tag_id) VALUES ($1,$2)', [securityId,toTagId])
    await this.db.execute('DELETE FROM security_tags WHERE security_id=$1 AND tag_id=$2', [securityId,fromTagId])
  }
  async addTag(input: Omit<Tag, 'id' | 'sortOrder'>) {
    const name = cleanRequired(input.name, 'a tag name')
    const rows = await this.db.select<Array<{ next_order: number }>>(`SELECT COALESCE(MAX(sort_order),-1)+1 next_order FROM tags WHERE taxonomy_id=$1 AND ${input.parentId ? 'parent_id=$2' : 'parent_id IS NULL'}`, input.parentId ? [input.taxonomyId,input.parentId] : [input.taxonomyId])
    const result = { ...input,id:uuid(),name,description:input.description.trim(),color:input.color.toUpperCase(),sortOrder:rows[0]?.next_order ?? 0 }
    try { await this.db.execute('INSERT INTO tags (id,taxonomy_id,parent_id,name,description,color,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)', [result.id,result.taxonomyId,result.parentId,result.name,result.description,result.color,result.sortOrder]) }
    catch { throw new Error('A tag with this name already exists at this level.') }
    return result
  }
  async updateTag(tag: Pick<Tag,'id'|'taxonomyId'|'name'|'description'|'color'>) {
    try { await this.db.execute('UPDATE tags SET name=$1,description=$2,color=$3 WHERE id=$4 AND taxonomy_id=$5', [cleanRequired(tag.name,'a tag name'),tag.description.trim(),tag.color.toUpperCase(),tag.id,tag.taxonomyId]) }
    catch { throw new Error('A tag with this name already exists at this level.') }
  }
  async moveTag(tagId: string, parentId: string | null, index: number) {
    const rows = await this.db.select<Array<{taxonomy_id:string;parent_id:string|null;name:string}>>('SELECT taxonomy_id,parent_id,name FROM tags WHERE id=$1',[tagId])
    const tag = rows[0]
    if (!tag) throw new Error('The selected tag no longer exists.')
    if (parentId) {
      const parents = await this.db.select<Array<{taxonomy_id:string}>>('SELECT taxonomy_id FROM tags WHERE id=$1',[parentId])
      if (!parents[0] || parents[0].taxonomy_id !== tag.taxonomy_id) throw new Error('The destination tag no longer exists.')
      const cycle = await this.db.select<unknown[]>('WITH RECURSIVE descendants(id) AS (SELECT id FROM tags WHERE id=$1 UNION ALL SELECT tags.id FROM tags JOIN descendants ON tags.parent_id=descendants.id) SELECT 1 FROM descendants WHERE id=$2 LIMIT 1',[tagId,parentId])
      if (cycle.length) throw new Error('A tag cannot be moved inside itself or one of its descendants.')
    }
    const duplicate = await this.db.select<unknown[]>(`SELECT 1 FROM tags WHERE id<>$1 AND taxonomy_id=$2 AND lower(name)=lower($3) AND ${parentId ? 'parent_id=$4' : 'parent_id IS NULL'} LIMIT 1`,parentId?[tagId,tag.taxonomy_id,tag.name,parentId]:[tagId,tag.taxonomy_id,tag.name])
    if (duplicate.length) throw new Error('A tag with this name already exists at this level.')
    const siblings = async(parentValue:string|null) => this.db.select<Array<{id:string}>>(`SELECT id FROM tags WHERE id<>$1 AND taxonomy_id=$2 AND ${parentValue ? 'parent_id=$3' : 'parent_id IS NULL'} ORDER BY sort_order,lower(name),id`,parentValue?[tagId,tag.taxonomy_id,parentValue]:[tagId,tag.taxonomy_id])
    if (tag.parent_id !== parentId) {
      const source = await siblings(tag.parent_id)
      for (const [position,item] of source.entries()) await this.db.execute('UPDATE tags SET sort_order=$1 WHERE id=$2',[position,item.id])
    }
    const destination = await siblings(parentId)
    const targetIndex = Math.max(0,Math.min(index,destination.length))
    destination.splice(targetIndex,0,{id:tagId})
    try { await this.db.execute('UPDATE tags SET parent_id=$1 WHERE id=$2',[parentId,tagId]) }
    catch { throw new Error('A tag with this name already exists at this level.') }
    for (const [position,item] of destination.entries()) await this.db.execute('UPDATE tags SET sort_order=$1 WHERE id=$2',[position,item.id])
  }
  async deleteTag(taxonomyId: string,id: string) {
    const children = await this.db.select<unknown[]>('SELECT 1 FROM tags WHERE parent_id=$1 AND archived_at IS NULL LIMIT 1',[id])
    if (children.length) throw new Error('Delete the child tags first.')
    await this.db.execute('DELETE FROM tags WHERE id=$1 AND taxonomy_id=$2',[id,taxonomyId])
  }
  async assignedTagIds(securityId:string) { const rows=await this.db.select<Array<{tag_id:string}>>('SELECT tag_id FROM security_tags WHERE security_id=$1',[securityId]); return rows.map((x)=>x.tag_id) }
  async setAssignedTags(securityId:string,tagIds:string[]) {
    await this.db.execute('DELETE FROM security_tags WHERE security_id=$1',[securityId])
    for (const tagId of tagIds) await this.db.execute('INSERT INTO security_tags (security_id,tag_id) VALUES ($1,$2)',[securityId,tagId])
  }
  async loadNote(securityId:string):Promise<SecurityNote> {
    const rows=await this.db.select<DbRow[]>('SELECT security_id,content_html,updated_at FROM security_notes WHERE security_id=$1',[securityId]); const x=rows[0]
    return x ? {securityId:String(x.security_id),contentHtml:String(x.content_html),updatedAt:String(x.updated_at)} : {securityId,contentHtml:'',updatedAt:''}
  }
  async saveNote(securityId:string,contentHtml:string) {
    const result={securityId,contentHtml,updatedAt:new Date().toISOString()}
    await this.db.execute('INSERT INTO security_notes (security_id,content_html,updated_at) VALUES ($1,$2,$3) ON CONFLICT(security_id) DO UPDATE SET content_html=excluded.content_html,updated_at=excluded.updated_at',[securityId,contentHtml,result.updatedAt]); return result
  }
  async listJournalEntries(securityId:string):Promise<SecurityJournalEntry[]> {
    const rows=await this.db.select<DbRow[]>('SELECT id,security_id,entry_date,content_html,created_at,updated_at FROM security_journal_entries WHERE security_id=$1 ORDER BY entry_date DESC,updated_at DESC',[securityId])
    return rows.map((row)=>({id:String(row.id),securityId:String(row.security_id),entryDate:String(row.entry_date),contentHtml:String(row.content_html),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
  }
  async saveJournalEntry(input:JournalEntryInput):Promise<SecurityJournalEntry> {
    const entryDate=cleanJournalDate(input.entryDate)
    const id=input.id ?? uuid()
    const existing=input.id ? await this.db.select<DbRow[]>('SELECT security_id,created_at FROM security_journal_entries WHERE id=$1',[input.id]) : []
    if (existing[0] && String(existing[0].security_id)!==input.securityId) throw new Error('The selected journal entry does not belong to this security.')
    const duplicates=await this.db.select<DbRow[]>('SELECT id FROM security_journal_entries WHERE security_id=$1 AND entry_date=$2 AND id<>$3 LIMIT 1',[input.securityId,entryDate,id])
    if (duplicates.length) throw new Error('A journal entry already exists for this date.')
    const now=new Date().toISOString()
    const result={id,securityId:input.securityId,entryDate,contentHtml:input.contentHtml,createdAt:existing[0]?String(existing[0].created_at):now,updatedAt:now}
    try {
      await this.db.execute('INSERT INTO security_journal_entries (id,security_id,entry_date,content_html,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,content_html=excluded.content_html,updated_at=excluded.updated_at',[result.id,result.securityId,result.entryDate,result.contentHtml,result.createdAt,result.updatedAt])
    } catch { throw new Error('A journal entry already exists for this date.') }
    return result
  }
  async deleteJournalEntry(id:string) { await this.db.execute('DELETE FROM security_journal_entries WHERE id=$1',[id]) }
  async listSecurityLinkTemplates():Promise<SecurityLinkTemplate[]> {
    const rows=await this.db.select<DbRow[]>('SELECT id,link_text,url_pattern,sort_order FROM security_link_templates ORDER BY sort_order,id')
    return rows.map((row)=>({id:String(row.id),linkText:String(row.link_text),urlPattern:String(row.url_pattern),sortOrder:Number(row.sort_order)}))
  }
  async saveSecurityLinkTemplates(templates:SecurityLinkTemplate[]) {
    const cleaned=templates.map(cleanSecurityLinkTemplate)
    const existing=await this.listSecurityLinkTemplates()
    for (const template of cleaned) await this.db.execute('INSERT INTO security_link_templates (id,link_text,url_pattern,sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET link_text=excluded.link_text,url_pattern=excluded.url_pattern,sort_order=excluded.sort_order',[template.id,template.linkText,template.urlPattern,template.sortOrder])
    const retained=new Set(cleaned.map((template)=>template.id))
    for (const template of existing) if (!retained.has(template.id)) await this.db.execute('DELETE FROM security_link_templates WHERE id=$1',[template.id])
    return cleaned
  }
  async listResearchTopics():Promise<ResearchTopic[]> {
    const rows=await this.db.select<DbRow[]>('SELECT id,title,created_at,updated_at FROM research_topics ORDER BY updated_at DESC,lower(title),id')
    return rows.map((row)=>({id:String(row.id),title:String(row.title),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
  }
  async addResearchTopic(value:string) {
    const now=new Date().toISOString(),result={id:uuid(),title:cleanRequired(value,'a topic title'),createdAt:now,updatedAt:now}
    try{await this.db.execute('INSERT INTO research_topics (id,title,created_at,updated_at) VALUES ($1,$2,$3,$4)',[result.id,result.title,result.createdAt,result.updatedAt])}
    catch{throw new Error('A research topic with this title already exists.')}
    return result
  }
  async updateResearchTopic(topic:Pick<ResearchTopic,'id'|'title'>) {
    try{await this.db.execute('UPDATE research_topics SET title=$1,updated_at=$2 WHERE id=$3',[cleanRequired(topic.title,'a topic title'),new Date().toISOString(),topic.id])}
    catch{throw new Error('A research topic with this title already exists.')}
  }
  async deleteResearchTopic(id:string) { await this.db.execute('DELETE FROM research_topics WHERE id=$1',[id]) }
  async loadResearchTopicNote(topicId:string):Promise<ResearchTopicNote> {
    const rows=await this.db.select<DbRow[]>('SELECT topic_id,content_html,updated_at FROM research_topic_notes WHERE topic_id=$1',[topicId]),row=rows[0]
    return row?{topicId:String(row.topic_id),contentHtml:String(row.content_html),updatedAt:String(row.updated_at)}:{topicId,contentHtml:'',updatedAt:''}
  }
  async saveResearchTopicNote(topicId:string,contentHtml:string) {
    const result={topicId,contentHtml,updatedAt:new Date().toISOString()}
    await this.db.execute('INSERT INTO research_topic_notes (topic_id,content_html,updated_at) VALUES ($1,$2,$3) ON CONFLICT(topic_id) DO UPDATE SET content_html=excluded.content_html,updated_at=excluded.updated_at',[topicId,contentHtml,result.updatedAt])
    await this.db.execute('UPDATE research_topics SET updated_at=$1 WHERE id=$2',[result.updatedAt,topicId]);return result
  }
  async listResearchTopicJournalEntries(topicId:string):Promise<ResearchTopicJournalEntry[]> {
    const rows=await this.db.select<DbRow[]>('SELECT id,topic_id,entry_date,content_html,created_at,updated_at FROM research_topic_journal_entries WHERE topic_id=$1 ORDER BY entry_date DESC,updated_at DESC',[topicId])
    return rows.map((row)=>({id:String(row.id),topicId:String(row.topic_id),entryDate:String(row.entry_date),contentHtml:String(row.content_html),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}))
  }
  async saveResearchTopicJournalEntry(input:TopicJournalEntryInput):Promise<ResearchTopicJournalEntry> {
    const entryDate=cleanJournalDate(input.entryDate),id=input.id??uuid()
    const existing=input.id?await this.db.select<DbRow[]>('SELECT topic_id,created_at FROM research_topic_journal_entries WHERE id=$1',[input.id]):[]
    if(existing[0]&&String(existing[0].topic_id)!==input.topicId)throw new Error('The selected journal entry does not belong to this research topic.')
    const duplicates=await this.db.select<DbRow[]>('SELECT id FROM research_topic_journal_entries WHERE topic_id=$1 AND entry_date=$2 AND id<>$3 LIMIT 1',[input.topicId,entryDate,id])
    if(duplicates.length)throw new Error('A journal entry already exists for this date.')
    const now=new Date().toISOString(),result={id,topicId:input.topicId,entryDate,contentHtml:input.contentHtml,createdAt:existing[0]?String(existing[0].created_at):now,updatedAt:now}
    try{await this.db.execute('INSERT INTO research_topic_journal_entries (id,topic_id,entry_date,content_html,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,content_html=excluded.content_html,updated_at=excluded.updated_at',[result.id,result.topicId,result.entryDate,result.contentHtml,result.createdAt,result.updatedAt])}
    catch{throw new Error('A journal entry already exists for this date.')}
    await this.db.execute('UPDATE research_topics SET updated_at=$1 WHERE id=$2',[now,input.topicId]);return result
  }
  async deleteResearchTopicJournalEntry(id:string) {
    const rows=await this.db.select<Array<{topic_id:string}>>('SELECT topic_id FROM research_topic_journal_entries WHERE id=$1',[id])
    await this.db.execute('DELETE FROM research_topic_journal_entries WHERE id=$1',[id])
    if(rows[0])await this.db.execute('UPDATE research_topics SET updated_at=$1 WHERE id=$2',[new Date().toISOString(),rows[0].topic_id])
  }
  async getResearchTopicRelations(topicId:string) {
    const direct=await this.db.select<Array<{security_id:string}>>('SELECT security_id FROM research_topic_securities WHERE topic_id=$1 ORDER BY security_id',[topicId])
    const rules=await this.db.select<Array<{tag_id:string}>>('SELECT tag_id FROM research_topic_tags WHERE topic_id=$1 ORDER BY tag_id',[topicId])
    const rows=await this.db.select<DbRow[]>(`WITH RECURSIVE descendant_tags(id) AS (
      SELECT tag_id FROM research_topic_tags WHERE topic_id=$1
      UNION SELECT tags.id FROM tags JOIN descendant_tags ON tags.parent_id=descendant_tags.id
    ), relation_sources(security_id,direct,dynamic) AS (
      SELECT security_id,1,0 FROM research_topic_securities WHERE topic_id=$1
      UNION ALL SELECT security_tags.security_id,0,1 FROM security_tags JOIN descendant_tags ON descendant_tags.id=security_tags.tag_id
    ) SELECT s.id,s.name,s.symbol,s.alternative_id,s.currency,MAX(relation_sources.direct) direct,MAX(relation_sources.dynamic) dynamic
      FROM relation_sources JOIN securities s ON s.id=relation_sources.security_id
      GROUP BY s.id,s.name,s.symbol,s.alternative_id,s.currency ORDER BY lower(s.symbol),s.id`,[topicId])
    return{directSecurityIds:direct.map((item)=>item.security_id),tagIds:rules.map((item)=>item.tag_id),relatedSecurities:rows.map((row)=>({...mapSecurity(row),direct:Boolean(row.direct),dynamic:Boolean(row.dynamic)}))}
  }
  async setResearchTopicRelations(topicId:string,directSecurityIds:string[],tagIds:string[]) {
    await this.db.execute('DELETE FROM research_topic_securities WHERE topic_id=$1',[topicId])
    await this.db.execute('DELETE FROM research_topic_tags WHERE topic_id=$1',[topicId])
    for(const securityId of new Set(directSecurityIds))await this.db.execute('INSERT INTO research_topic_securities (topic_id,security_id) VALUES ($1,$2)',[topicId,securityId])
    for(const tagId of new Set(tagIds))await this.db.execute('INSERT INTO research_topic_tags (topic_id,tag_id) VALUES ($1,$2)',[topicId,tagId])
    await this.db.execute('UPDATE research_topics SET updated_at=$1 WHERE id=$2',[new Date().toISOString(),topicId])
  }
}
