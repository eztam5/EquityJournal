import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'

describe('LocalRepository',()=>{
  beforeEach(()=>localStorage.clear())
  it('persists securities and enforces case-insensitive symbols',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'aapl',currency:'usd',name:'Apple Inc.'})
    expect(security.symbol).toBe('AAPL')
    await expect(repository.addSecurity({symbol:'Aapl',currency:'USD',name:'Other'})).rejects.toThrow('already exists')
    const next=new LocalRepository();await next.initialize();expect(await next.listSecurities()).toEqual([security])
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
})
