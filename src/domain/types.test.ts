import { describe, expect, it } from 'vitest'
import { buildTagTree, type Tag } from './types'

describe('buildTagTree', () => {
  it('builds and sorts an arbitrarily deep hierarchy', () => {
    const tags: Tag[] = [
      { id:'child',taxonomyId:'t',parentId:'root',name:'Child',description:'',color:'#111111',sortOrder:0 },
      { id:'root-2',taxonomyId:'t',parentId:null,name:'B root',description:'',color:'#222222',sortOrder:1 },
      { id:'root',taxonomyId:'t',parentId:null,name:'A root',description:'',color:'#111111',sortOrder:0 },
      { id:'grandchild',taxonomyId:'t',parentId:'child',name:'Grandchild',description:'',color:'#111111',sortOrder:0 },
    ]
    const tree=buildTagTree(tags)
    expect(tree.map((x)=>x.id)).toEqual(['root','root-2'])
    expect(tree[0].children[0].children[0].id).toBe('grandchild')
  })
})
