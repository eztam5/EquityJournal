import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecuritiesView } from './SecuritiesView'
import { Sidebar } from './Sidebar'
import { TaxonomyView } from './TaxonomyView'

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

  it('places Update quotes second in the All Securities context menu',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    fireEvent.contextMenu(screen.getByRole('button',{name:'All Securities'}),{clientX:20,clientY:30})

    expect((await screen.findAllByRole('menuitem')).map((item)=>item.textContent)).toEqual(['New security','Update quotes'])
  })

  it('updates only the securities in the selected watchlist',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    await repository.setWatchlistSecurity(watchlist.id,apple.id,true)
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({chart:{result:[{meta:{symbol:'AAPL',currency:'USD',exchangeName:'NMS',exchangeTimezoneName:'America/New_York'},timestamp:[Date.UTC(2026,8,18,20)/1000],indicators:{quote:[{close:[250]}],adjclose:[{adjclose:[250]}]}}]}})})
    vi.stubGlobal('fetch',fetch)
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    fireEvent.contextMenu(await screen.findByRole('button',{name:'Quality'}),{clientX:20,clientY:30})
    const items=await screen.findAllByRole('menuitem')
    expect(items.slice(0,2).map((item)=>item.textContent)).toEqual(['Rename','Update quotes'])
    fireEvent.click(screen.getByRole('menuitem',{name:'Update quotes'}))

    await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1))
    expect(String(fetch.mock.calls[0][0])).toContain('/AAPL?')
    expect(String(fetch.mock.calls[0][0])).not.toContain('MSFT')
  })

  it('edits a taxonomy from its context menu',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addTaxonomy({name:'Industry',description:'Company classification',color:'#4F7CAC'})
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    fireEvent.contextMenu(await screen.findByRole('button',{name:'Industry'}),{clientX:20,clientY:30})
    fireEvent.click(await screen.findByRole('menuitem',{name:'Edit'}))
    const dialog=screen.getByRole('dialog',{name:'Edit taxonomy'})
    expect(within(dialog).getByLabelText(/^Description/)).toHaveValue('Company classification')
    fireEvent.change(within(dialog).getByLabelText('Name'),{target:{value:'Sectors'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    expect(await screen.findByRole('button',{name:'Sectors'})).toBeInTheDocument()
    expect(await repository.listTaxonomies()).toEqual([expect.objectContaining({name:'Sectors',description:'Company classification'})])
  })

  it('reloads an expanded taxonomy tree after a tag is edited in the taxonomy view',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const tag=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/><TaxonomyView id={taxonomy.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Expand Industry'}))
    const sidebar=document.querySelector<HTMLElement>('.sidebar')!
    expect(await within(sidebar).findByText('Software')).toBeInTheDocument()
    const mainTag=document.querySelector<HTMLElement>(`.taxonomy-card [data-taxonomy-tag-id="${tag.id}"]`)
    expect(mainTag).not.toBeNull()
    fireEvent.contextMenu(mainTag!,{clientX:20,clientY:30})
    fireEvent.click(await screen.findByRole('menuitem',{name:'Edit Tag'}))
    const dialog=screen.getByRole('dialog',{name:'Edit tag'})
    fireEvent.change(within(dialog).getByLabelText('Name'),{target:{value:'Technology'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    expect(await within(sidebar).findByText('Technology')).toBeInTheDocument()
    expect(within(sidebar).queryByText('Software')).not.toBeInTheDocument()
  })

  it('moves watchlists while keeping All Securities first',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addWatchlist('First')
    await repository.addWatchlist('Second')
    await repository.addWatchlist('Third')
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/></AppProvider>)

    fireEvent.contextMenu(await screen.findByRole('button',{name:'Second'}),{clientX:20,clientY:30})
    fireEvent.click(await screen.findByRole('menuitem',{name:'Move up'}))

    await waitFor(()=>expect([...document.querySelectorAll('.securities-list-item')].map((item)=>item.textContent)).toEqual(['All Securities','Second','First','Third']))
    fireEvent.contextMenu(screen.getByRole('button',{name:'Second'}),{clientX:20,clientY:30})
    expect(await screen.findByRole('menuitem',{name:'Move up'})).toHaveAttribute('aria-disabled','true')
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

  it('selects with the platform modifier and drags all selected securities',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const microsoft=await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()} onNewTopic={vi.fn()}/><SecuritiesView/></AppProvider>)

    const appleRow=(await screen.findByText('Apple Inc.')).closest('tr')!
    const microsoftRow=screen.getByText('Microsoft').closest('tr')!
    fireEvent.click(appleRow,{ctrlKey:true})
    fireEvent.click(microsoftRow,{ctrlKey:true})
    expect(appleRow).toHaveClass('security-selected')
    expect(microsoftRow).toHaveClass('security-selected')

    const target=screen.getByRole('button',{name:'Quality'})
    class TestPointerEvent extends MouseEvent { pointerId:number;constructor(type:string,init:PointerEventInit){super(type,init);this.pointerId=init.pointerId??0} }
    vi.stubGlobal('PointerEvent',TestPointerEvent)
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>target)})
    fireEvent.pointerDown(appleRow,{button:0,pointerId:1,clientX:10,clientY:10})
    fireEvent.pointerMove(appleRow,{pointerId:1,clientX:30,clientY:30})
    fireEvent.pointerUp(appleRow,{pointerId:1,clientX:30,clientY:30})

    await waitFor(async()=>expect((await repository.listSecurities(watchlist.id)).map((security)=>security.id)).toEqual([apple.id,microsoft.id]))
  })

  it('selects a contiguous range with Shift',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    await repository.addSecurity({symbol:'NVDA',name:'Nvidia',currency:'USD'})
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    const appleRow=(await screen.findByText('Apple Inc.')).closest('tr')!
    const microsoftRow=screen.getByText('Microsoft').closest('tr')!
    const nvidiaRow=screen.getByText('Nvidia').closest('tr')!
    fireEvent.click(appleRow)
    fireEvent.click(nvidiaRow,{shiftKey:true})

    expect(appleRow).toHaveClass('security-selected')
    expect(microsoftRow).toHaveClass('security-selected')
    expect(nvidiaRow).toHaveClass('security-selected')
  })
})
