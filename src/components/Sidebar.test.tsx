import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecuritiesView } from './SecuritiesView'
import { Sidebar } from './Sidebar'

describe('Sidebar taxonomy navigation',()=>{
  afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();Reflect.deleteProperty(document,'elementFromPoint')})

  it('starts folded and opens a security through the taxonomy tree',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.setAssignedTags(security.id,[software.id])

    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    expect(await screen.findByText('Industry')).toBeInTheDocument()
    expect(screen.queryByText('Software')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button',{name:'Expand Industry'}))
    expect(await screen.findByText('Software')).toBeInTheDocument()
    expect(screen.queryByText('AAPL — Apple Inc.')).not.toBeInTheDocument()

    const softwareButton=screen.getByRole('button',{name:'Expand Software'})
    expect(softwareButton.querySelectorAll('.taxonomy-sidebar-marker')).toHaveLength(1)
    expect(softwareButton.querySelector('.nav-marker')).toBeNull()
    fireEvent.click(softwareButton)
    const securityButton=await screen.findByRole('button',{name:'AAPL — Apple Inc.'})
    fireEvent.click(securityButton)
    await waitFor(()=>expect(securityButton).toHaveClass('active'))

    fireEvent.click(screen.getByRole('button',{name:'Collapse Industry'}))
    expect(screen.queryByText('Software')).not.toBeInTheDocument()
  })

  it('uses the configured company-name-only labels in its taxonomy tree',async()=>{
    localStorage.setItem('equity-journal.security-display-mode','name-only')
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.setAssignedTags(security.id,[software.id])

    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)
    fireEvent.click(await screen.findByRole('button',{name:'Expand Industry'}))
    fireEvent.click(await screen.findByRole('button',{name:'Expand Software'}))

    expect(await screen.findByRole('button',{name:'Apple Inc.'})).toBeInTheDocument()
    expect(screen.queryByText('AAPL — Apple Inc.')).not.toBeInTheDocument()
  })

  it('uses the configured label in Recently Viewed',async()=>{
    localStorage.setItem('equity-journal.security-display-mode','name-first')
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    localStorage.setItem('equity-journal.recent-securities',JSON.stringify([security.id]))
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    expect(await screen.findByText('Recently Viewed')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Apple Inc. — AAPL'})).toBeInTheDocument()
  })

  it('renames a watchlist from its context menu',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addWatchlist('Quality')
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    fireEvent.contextMenu(await screen.findByRole('button',{name:'Quality'}),{clientX:20,clientY:30})
    fireEvent.click(await screen.findByRole('menuitem',{name:'Rename'}))
    const dialog=screen.getByRole('dialog',{name:'Rename watchlist'})
    fireEvent.change(within(dialog).getByLabelText('List name'),{target:{value:'High Quality'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    expect(await screen.findByRole('button',{name:'High Quality'})).toBeInTheDocument()
    expect(await repository.listWatchlists()).toEqual([expect.objectContaining({name:'High Quality'})])
  })

  it('adds a security to the watchlist with pointer-based dragging',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/><SecuritiesView/></AppProvider>)

    const row=(await screen.findByText('Apple Inc.')).closest('tr')
    expect(row).not.toBeNull()
    const target=screen.getByRole('button',{name:'Quality'})
    class TestPointerEvent extends MouseEvent { pointerId:number;constructor(type:string,init:PointerEventInit){super(type,init);this.pointerId=init.pointerId??0} }
    vi.stubGlobal('PointerEvent',TestPointerEvent)
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>target)})
    fireEvent.pointerDown(row!,{button:0,pointerId:1,clientX:10,clientY:10})
    fireEvent.pointerMove(row!,{pointerId:1,clientX:30,clientY:30})
    expect(target).toHaveClass('drop-target')
    fireEvent.pointerUp(row!,{pointerId:1,clientX:30,clientY:30})

    await waitFor(async()=>expect(await repository.listSecurities(watchlist.id)).toEqual([security]))
    expect(target).not.toHaveClass('drop-target')
  })
})
