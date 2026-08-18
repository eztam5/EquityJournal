import { describe, expect, it } from 'vitest'
import type { Tag, TaggedSecurity } from '../domain/types'
import { buildTaxonomyTreeModel } from './taxonomyTreeModel'

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
})
