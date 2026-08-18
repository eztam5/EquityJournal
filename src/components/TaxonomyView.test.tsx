import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { TaxonomyView } from './TaxonomyView'

describe('TaxonomyView drag and drop',()=>{
  afterEach(()=>{localStorage.clear();Reflect.deleteProperty(document,'elementFromPoint')})

  it('copies a security with the platform drag modifier',async()=>{
    const modifier=/Mac|iPhone|iPad|iPod/.test(navigator.platform)?{altKey:true}:{ctrlKey:true}
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const source=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const target=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Financial Services',description:'',color:taxonomy.color})
    const security=await repository.addSecurity({symbol:'DLO',name:'dLocal',currency:'USD'})
    await repository.setAssignedTags(security.id,[source.id])
    render(<AppProvider repository={repository}><TaxonomyView id={taxonomy.id}/></AppProvider>)
    const sourceLabel=await screen.findByText('Software')
    await waitFor(()=>expect(sourceLabel.closest('li')!.querySelector('.bp6-tree-node-caret')).toBeTruthy())
    fireEvent.click(sourceLabel.closest('li')!.querySelector('.bp6-tree-node-caret')!)
    const securityLabel=await screen.findByText('DLO — dLocal')
    const securityIcon=securityLabel.closest('.bp6-tree-node-content')!.querySelector('.bp6-tree-node-icon')!
    const targetLabel=screen.getByText('Financial Services')
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>targetLabel})
    fireEvent.pointerDown(securityIcon,{button:0,pointerId:1})
    expect(document.documentElement).toHaveClass('taxonomy-security-dragging')
    fireEvent.keyDown(document,{key:'altKey' in modifier?'Alt':'Control',...modifier})
    fireEvent.pointerMove(securityIcon,{clientX:10,clientY:10,pointerId:1})
    await waitFor(()=>expect(targetLabel).toHaveClass('drop-target'))
    expect(targetLabel).toHaveClass('copy-target')
    fireEvent.pointerUp(securityIcon,{clientX:10,clientY:10,pointerId:1})
    await waitFor(async()=>expect(new Set(await repository.assignedTagIds(security.id))).toEqual(new Set([source.id,target.id])))
    expect(document.documentElement).not.toHaveClass('taxonomy-security-dragging')
  })
})
