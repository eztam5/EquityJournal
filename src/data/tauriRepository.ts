import Database from '@tauri-apps/plugin-sql'
import type { Security, SecurityNote, Tag, Taxonomy, Watchlist } from '../domain/types'
import { cleanRequired, type EquityRepository, uuid } from './repository'

type DbRow = Record<string, string | number | null>

export class TauriRepository implements EquityRepository {
  private db!: Database
  async initialize() {
    this.db = await Database.load('sqlite:equity-journal.sqlite3')
    await this.db.execute('PRAGMA foreign_keys = ON')
  }
  async listSecurities(watchlistId?: string): Promise<Security[]> {
    if (watchlistId) return this.db.select<Security[]>('SELECT s.id, s.name, s.symbol, s.currency FROM securities s JOIN watchlist_securities ws ON ws.security_id=s.id WHERE ws.watchlist_id=$1 ORDER BY lower(s.symbol), s.id', [watchlistId])
    return this.db.select('SELECT id, name, symbol, currency FROM securities ORDER BY lower(symbol), id')
  }
  async addSecurity(input: Omit<Security, 'id'>) {
    const result = { id: uuid(), name: cleanRequired(input.name, 'a company name'), symbol: cleanRequired(input.symbol, 'a symbol').toUpperCase(), currency: cleanRequired(input.currency, 'a currency').toUpperCase() }
    try { await this.db.execute('INSERT INTO securities (id,name,symbol,currency) VALUES ($1,$2,$3,$4)', [result.id, result.name, result.symbol, result.currency]) }
    catch { throw new Error('A security with this symbol already exists.') }
    return result
  }
  async updateSecurity(s: Security) {
    const name = cleanRequired(s.name, 'a company name'), symbol = cleanRequired(s.symbol, 'a symbol').toUpperCase(), currency = cleanRequired(s.currency, 'a currency').toUpperCase()
    try { await this.db.execute('UPDATE securities SET name=$1,symbol=$2,currency=$3 WHERE id=$4', [name, symbol, currency, s.id]) }
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
}
