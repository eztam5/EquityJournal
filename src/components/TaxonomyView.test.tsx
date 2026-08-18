import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { TaxonomyView } from './TaxonomyView'

describe('TaxonomyView drag and drop',()=>{
  beforeEach(()=>Object.defineProperty(window,'PointerEvent',{configurable:true,value:MouseEvent}))
  afterEach(()=>{cleanup();localStorage.clear();Reflect.deleteProperty(document,'elementFromPoint');Reflect.deleteProperty(window,'PointerEvent')})

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
    const sourceCaret=sourceLabel.closest('li')!.querySelector('.bp6-tree-node-caret')!
    fireEvent.pointerDown(sourceCaret,{button:0,clientX:10,clientY:10,pointerId:7})
    fireEvent.pointerUp(sourceCaret,{clientX:10,clientY:10,pointerId:7})
    fireEvent.click(sourceCaret)
    const securityLabel=await screen.findByText('DLO — dLocal')
    const securityIcon=securityLabel.closest('.bp6-tree-node-content')!.querySelector('.bp6-tree-node-icon')!
    const targetLabel=screen.getByText('Financial Services')
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>targetLabel})
    fireEvent.pointerDown(securityIcon,{button:0,pointerId:1})
    expect(document.documentElement).not.toHaveClass('taxonomy-security-dragging')
    fireEvent.keyDown(document,{key:'altKey' in modifier?'Alt':'Control',...modifier})
    fireEvent.pointerMove(securityIcon,{clientX:10,clientY:10,pointerId:1})
    expect(document.documentElement).toHaveClass('taxonomy-security-dragging')
    await waitFor(()=>expect(targetLabel).toHaveClass('drop-target'))
    expect(targetLabel).toHaveClass('copy-target')
    fireEvent.pointerUp(securityIcon,{clientX:10,clientY:10,pointerId:1})
    await waitFor(async()=>expect(new Set(await repository.assignedTagIds(security.id))).toEqual(new Set([source.id,target.id])))
    expect(document.documentElement).not.toHaveClass('taxonomy-security-dragging')
  })

  it('filters in memory by security name and keeps the tag path visible',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const parent=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Industries',description:'',color:taxonomy.color})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:parent.id,name:'Software',description:'',color:taxonomy.color})
    await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Regions',description:'',color:taxonomy.color})
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const sap=await repository.addSecurity({symbol:'SAP',name:'SAP SE',currency:'EUR'})
    await repository.setAssignedTags(apple.id,[software.id])
    await repository.setAssignedTags(sap.id,[software.id])

    render(<AppProvider repository={repository}><TaxonomyView id={taxonomy.id}/></AppProvider>)
    fireEvent.change(await screen.findByLabelText('Search tags or securities'),{target:{value:'apple'}})

    expect(await screen.findByText('Apple Inc.',{exact:false})).toBeInTheDocument()
    expect(screen.getByText('Industries')).toBeInTheDocument()
    expect(screen.getByText('Software')).toBeInTheDocument()
    expect(screen.queryByText('Regions')).not.toBeInTheDocument()
    expect(screen.queryByText('SAP SE',{exact:false})).not.toBeInTheDocument()
  })
})
