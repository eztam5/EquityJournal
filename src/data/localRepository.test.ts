import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'
import { resolveSecurityLink } from './repository'

describe('LocalRepository',()=>{
  beforeEach(()=>localStorage.clear())
  it('persists securities and enforces case-insensitive symbols',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'aapl',currency:'usd',name:'Apple Inc.'})
    expect(security.symbol).toBe('AAPL')
    await expect(repository.addSecurity({symbol:'Aapl',currency:'USD',name:'Other'})).rejects.toThrow('already exists')
    const next=new LocalRepository();await next.initialize();expect(await next.listSecurities()).toEqual([security])
  })
  it('stores alternative IDs and resolves global security link templates',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'aapl',alternativeId:'US0378331005',currency:'usd',name:'Apple Inc.'})
    const templates=await repository.saveSecurityLinkTemplates([
      {id:'symbol-link',linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0},
      {id:'id-link',linkText:'Identifier lookup',urlPattern:'https://example.com/security/{ALTERNATIVE_ID}',sortOrder:1},
    ])

    expect(security.alternativeId).toBe('US0378331005')
    expect(resolveSecurityLink(templates[0],security)).toBe('https://finance.yahoo.com/quote/AAPL')
    expect(resolveSecurityLink(templates[1],security)).toBe('https://example.com/security/US0378331005')
    expect(resolveSecurityLink(templates[1],{...security,alternativeId:''})).toBeNull()
    expect(await repository.listSecurityLinkTemplates()).toEqual(templates)
    await expect(repository.saveSecurityLinkTemplates([{id:'bad',linkText:'Bad',urlPattern:'javascript:{SYMBOL}',sortOrder:0}])).rejects.toThrow('HTTP or HTTPS')
  })
  it('deletes a watchlist and its memberships without deleting securities',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',currency:'CHF',name:'Nestlé'})
    const watchlist=await repository.addWatchlist('Swiss shares')
    await repository.setWatchlistSecurity(watchlist.id,security.id,true)

    await repository.deleteWatchlist(watchlist.id)

    expect(await repository.listWatchlists()).toEqual([])
    expect(await repository.listSecurities(watchlist.id)).toEqual([])
    expect(await repository.listSecurities()).toEqual([security])
  })
  it('renames a watchlist while preserving its memberships',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',currency:'CHF',name:'Nestlé'})
    const watchlist=await repository.addWatchlist('Swiss shares')
    await repository.setWatchlistSecurity(watchlist.id,security.id,true)

    await repository.updateWatchlist({...watchlist,name:'Quality shares'})

    expect(await repository.listWatchlists()).toEqual([{...watchlist,name:'Quality shares'}])
    expect(await repository.listSecurities(watchlist.id)).toEqual([security])
  })
  it('persists a custom watchlist order',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const first=await repository.addWatchlist('First')
    const second=await repository.addWatchlist('Second')
    const third=await repository.addWatchlist('Third')

    await repository.moveWatchlist(third.id,-1)
    await repository.moveWatchlist(first.id,1)

    expect((await repository.listWatchlists()).map((watchlist)=>watchlist.id)).toEqual([third.id,first.id,second.id])
  })
  it('creates nested tags and rejects deleting a parent with children',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Risks',description:'',color:'#C25555'})
    const parent=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Financial',description:'',color:taxonomy.color})
    await repository.addTag({taxonomyId:taxonomy.id,parentId:parent.id,name:'Leverage',description:'',color:taxonomy.color})
    await expect(repository.deleteTag(taxonomy.id,parent.id)).rejects.toThrow('child tags first')
  })
  it('stores classifications and rich-text notes per security',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'MSFT',currency:'USD',name:'Microsoft'})
    const taxonomy=await repository.addTaxonomy({name:'Thesis',description:'',color:'#4F7CAC'})
    const tag=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Moat',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[tag.id]);expect(await repository.assignedTagIds(security.id)).toEqual([tag.id])
    expect(await repository.listTaggedSecurities(taxonomy.id)).toEqual([{...security,tagId:tag.id}])
    await repository.saveNote(security.id,'<h1>Thesis</h1>');expect((await repository.loadNote(security.id)).contentHtml).toBe('<h1>Thesis</h1>')
  })
  it('stores dated journal entries newest-first and enforces one entry per date',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'BRK.B',currency:'USD',name:'Berkshire Hathaway'})
    const older=await repository.saveJournalEntry({securityId:security.id,entryDate:'2026-03-01',contentHtml:'<p>Annual report</p>'})
    const newer=await repository.saveJournalEntry({securityId:security.id,entryDate:'2026-08-18',contentHtml:'<p>Quarterly report</p>'})

    expect((await repository.listJournalEntries(security.id)).map((entry)=>entry.id)).toEqual([newer.id,older.id])
    await expect(repository.saveJournalEntry({securityId:security.id,entryDate:newer.entryDate,contentHtml:'Duplicate'})).rejects.toThrow('already exists')

    const updated=await repository.saveJournalEntry({...older,entryDate:'2026-04-01',contentHtml:'<p>Updated view</p>'})
    expect(updated.createdAt).toBe(older.createdAt)
    expect((await repository.listJournalEntries(security.id)).find((entry)=>entry.id===older.id)?.contentHtml).toBe('<p>Updated view</p>')

    await repository.deleteJournalEntry(newer.id)
    expect((await repository.listJournalEntries(security.id)).map((entry)=>entry.id)).toEqual([older.id])
    await repository.deleteSecurity(security.id)
    expect(await repository.listJournalEntries(security.id)).toEqual([])
  })
  it('stores, edits, de-duplicates, and deletes security document metadata',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'ROG',currency:'CHF',name:'Roche'})
    const document=await repository.addSecurityDocument({id:'document-1',securityId:security.id,title:'  Q2 research  ',originalFilename:'q2.pdf',storagePath:`attachments/securities/${security.id}/document-1.pdf`,source:'  UBS  ',documentDate:'2026-08-01',mimeType:'application/pdf',fileSize:2048,sha256:'abc123'})

    expect(document).toEqual(expect.objectContaining({title:'Q2 research',source:'UBS',documentDate:'2026-08-01'}))
    await expect(repository.addSecurityDocument({...document,id:'document-2',storagePath:`attachments/securities/${security.id}/document-2.pdf`})).rejects.toThrow('already attached')
    await repository.updateSecurityDocument({id:document.id,title:'Updated research',source:'Bank research',documentDate:''})
    expect(await repository.listSecurityDocuments(security.id)).toEqual([expect.objectContaining({title:'Updated research',source:'Bank research',documentDate:''})])

    await repository.deleteSecurity(security.id)
    expect(await repository.listSecurityDocuments(security.id)).toEqual([])
  })
  it('moves a security between tags without changing its other assignments',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'ASML',currency:'EUR',name:'ASML'})
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const source=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Technology',description:'',color:taxonomy.color})
    const target=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Semiconductors',description:'',color:taxonomy.color})
    const retained=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Europe',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[source.id,retained.id])

    await repository.moveSecurityTag(security.id,source.id,target.id)

    expect(new Set(await repository.assignedTagIds(security.id))).toEqual(new Set([target.id,retained.id]))
  })
  it('copies a security to another tag while retaining its source assignment',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'ASML',currency:'EUR',name:'ASML'})
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const source=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Technology',description:'',color:taxonomy.color})
    const target=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Semiconductors',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[source.id])

    await repository.copySecurityTag(security.id,target.id)

    expect(new Set(await repository.assignedTagIds(security.id))).toEqual(new Set([source.id,target.id]))

    await repository.removeSecurityTag(security.id,source.id)

    expect(await repository.assignedTagIds(security.id)).toEqual([target.id])
  })
  it('deletes a taxonomy with its nested tags and assignments',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NVDA',currency:'USD',name:'NVIDIA'})
    const taxonomy=await repository.addTaxonomy({name:'Quality',description:'',color:'#2E8B78'})
    const parent=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Management',description:'',color:taxonomy.color})
    const child=await repository.addTag({taxonomyId:taxonomy.id,parentId:parent.id,name:'Execution',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[parent.id,child.id])

    await repository.deleteTaxonomy(taxonomy.id)

    expect(await repository.listTaxonomies()).toEqual([])
    expect(await repository.listTags(taxonomy.id)).toEqual([])
    expect(await repository.assignedTagIds(security.id)).toEqual([])
  })
  it('reparents and reorders tags while preventing cycles',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const a=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'A',description:'',color:taxonomy.color})
    const b=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'B',description:'',color:taxonomy.color})
    const c=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'C',description:'',color:taxonomy.color})
    const child=await repository.addTag({taxonomyId:taxonomy.id,parentId:a.id,name:'Child',description:'',color:taxonomy.color})

    await repository.moveTag(c.id,null,0)
    let tags=await repository.listTags(taxonomy.id)
    expect(tags.filter((tag)=>tag.parentId===null).toSorted((left,right)=>left.sortOrder-right.sortOrder).map((tag)=>tag.id)).toEqual([c.id,a.id,b.id])

    await repository.moveTag(b.id,a.id,0)
    tags=await repository.listTags(taxonomy.id)
    expect(tags.filter((tag)=>tag.parentId===a.id).toSorted((left,right)=>left.sortOrder-right.sortOrder).map((tag)=>tag.id)).toEqual([b.id,child.id])

    await repository.moveTag(b.id,null,1)
    tags=await repository.listTags(taxonomy.id)
    expect(tags.filter((tag)=>tag.parentId===null).toSorted((left,right)=>left.sortOrder-right.sortOrder).map((tag)=>tag.id)).toEqual([c.id,b.id,a.id])
    await expect(repository.moveTag(a.id,child.id,0)).rejects.toThrow('descendants')
  })
  it('combines direct topic securities with dynamic tag descendants',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const vms=await repository.addTag({taxonomyId:taxonomy.id,parentId:software.id,name:'VMS',description:'',color:taxonomy.color})
    const apple=await repository.addSecurity({symbol:'AAPL',currency:'USD',name:'Apple'})
    const constellation=await repository.addSecurity({symbol:'CSU',currency:'CAD',name:'Constellation Software'})
    await repository.setAssignedTags(constellation.id,[vms.id])
    const topic=await repository.addResearchTopic('Serial acquirers in VMS')
    await repository.setResearchTopicRelations(topic.id,[apple.id,constellation.id],[software.id])

    let relations=await repository.getResearchTopicRelations(topic.id)
    expect(relations.relatedSecurities).toEqual([
      expect.objectContaining({id:apple.id,direct:true,dynamic:false}),
      expect.objectContaining({id:constellation.id,direct:true,dynamic:true}),
    ])

    const topicus=await repository.addSecurity({symbol:'TOI',currency:'CAD',name:'Topicus'})
    await repository.setAssignedTags(topicus.id,[vms.id])
    relations=await repository.getResearchTopicRelations(topic.id)
    expect(relations.relatedSecurities.map((security)=>security.id)).toEqual([apple.id,constellation.id,topicus.id])
  })
  it('stores topic theses and journals and deletes them with the topic',async()=>{
    const repository=new LocalRepository();await repository.initialize();const topic=await repository.addResearchTopic('Pricing power')
    await repository.saveResearchTopicNote(topic.id,'<p>Current topic thesis</p>')
    const entry=await repository.saveResearchTopicJournalEntry({topicId:topic.id,entryDate:'2026-08-19',contentHtml:'<p>New evidence</p>'})

    expect((await repository.loadResearchTopicNote(topic.id)).contentHtml).toBe('<p>Current topic thesis</p>')
    expect(await repository.listResearchTopicJournalEntries(topic.id)).toEqual([entry])

    await repository.deleteResearchTopic(topic.id)
    expect(await repository.listResearchTopics()).toEqual([])
    expect((await repository.loadResearchTopicNote(topic.id)).contentHtml).toBe('')
    expect(await repository.listResearchTopicJournalEntries(topic.id)).toEqual([])
  })
})
