import { describe, expect, it } from 'vitest'
import type { Tag, TaggedSecurity } from '../domain/types'
import { buildTaxonomyTreeModel, filterTaxonomyTreeModel, resolveTagDrop } from './taxonomyTreeModel'

describe('buildTaxonomyTreeModel', () => {
  it('builds mixed tag and assignment nodes without mutating its inputs', () => {
    const tags: Tag[] = [
      { id:'child',taxonomyId:'taxonomy',parentId:'parent',name:'Software',description:'',color:'#111111',sortOrder:0 },
      { id:'parent',taxonomyId:'taxonomy',parentId:null,name:'Industries',description:'',color:'#111111',sortOrder:0 },
      { id:'other',taxonomyId:'taxonomy',parentId:null,name:'Other',description:'',color:'#222222',sortOrder:1 },
    ]
    const assignments: TaggedSecurity[] = [
      { id:'two',tagId:'child',symbol:'ZZZ',name:'Second',currency:'USD' },
      { id:'one',tagId:'child',symbol:'AAA',name:'First',currency:'USD' },
      { id:'one',tagId:'other',symbol:'AAA',name:'First',currency:'USD' },
    ]
    const originalTags=structuredClone(tags),originalAssignments=structuredClone(assignments)

    const model=buildTaxonomyTreeModel(tags,assignments)

    expect(model.map((node)=>node.id)).toEqual(['parent','other'])
    expect(model[0].kind).toBe('tag')
    if(model[0].kind!=='tag'||model[0].children[0].kind!=='tag')throw new Error('Expected nested tag nodes')
    expect(model[0].children[0].children.map((node)=>node.id)).toEqual(['security:child:one','security:child:two'])
    expect(model[1].kind==='tag'&&model[1].children.map((node)=>node.id)).toEqual(['security:other:one'])
    expect(tags).toEqual(originalTags)
    expect(assignments).toEqual(originalAssignments)
  })

  it('resolves child, sibling, and root tag drops while rejecting cycles',()=>{
    const tags:Tag[]=[
      {id:'a',taxonomyId:'taxonomy',parentId:null,name:'A',description:'',color:'#111',sortOrder:0},
      {id:'b',taxonomyId:'taxonomy',parentId:null,name:'B',description:'',color:'#111',sortOrder:1},
      {id:'child',taxonomyId:'taxonomy',parentId:'a',name:'Child',description:'',color:'#111',sortOrder:0},
    ]
    expect(resolveTagDrop(tags,'b','a','inside')).toEqual({parentId:'a',index:1})
    expect(resolveTagDrop(tags,'b','a','before')).toEqual({parentId:null,index:0})
    expect(resolveTagDrop(tags,'child','b','after')).toEqual({parentId:null,index:2})
    expect(resolveTagDrop(tags,'child',null,'root')).toEqual({parentId:null,index:2})
    expect(resolveTagDrop(tags,'a','child','inside')).toBeNull()
    expect(resolveTagDrop(tags,'a','child','before')).toBeNull()
  })

  it('filters tags and securities while retaining their ancestor paths',()=>{
    const tags:Tag[]=[
      {id:'parent',taxonomyId:'taxonomy',parentId:null,name:'Industries',description:'',color:'#111',sortOrder:0},
      {id:'child',taxonomyId:'taxonomy',parentId:'parent',name:'Software',description:'',color:'#111',sortOrder:0},
      {id:'other',taxonomyId:'taxonomy',parentId:null,name:'Regions',description:'',color:'#111',sortOrder:1},
    ]
    const assignments:TaggedSecurity[]=[
      {id:'apple',tagId:'child',symbol:'AAPL',name:'Apple Inc.',currency:'USD'},
      {id:'sap',tagId:'child',symbol:'SAP',name:'SAP SE',currency:'EUR'},
    ]
    const model=buildTaxonomyTreeModel(tags,assignments)

    const bySecurity=filterTaxonomyTreeModel(model,'apple')
    expect(bySecurity.map((node)=>node.id)).toEqual(['parent'])
    expect(bySecurity[0].kind==='tag'&&bySecurity[0].children[0].kind==='tag'&&bySecurity[0].children[0].children.map((node)=>node.id)).toEqual(['security:child:apple'])

    const byTag=filterTaxonomyTreeModel(model,'software')
    expect(byTag[0].kind==='tag'&&byTag[0].children.map((node)=>node.id)).toEqual(['child'])
    expect(filterTaxonomyTreeModel(model,'  ')).toBe(model)
    expect(filterTaxonomyTreeModel(model,'missing')).toEqual([])
  })
})
