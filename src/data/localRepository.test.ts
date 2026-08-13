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
    await repository.saveNote(security.id,'<h1>Thesis</h1>');expect((await repository.loadNote(security.id)).contentHtml).toBe('<h1>Thesis</h1>')
  })
})
