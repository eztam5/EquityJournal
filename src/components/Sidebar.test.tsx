import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { Sidebar } from './Sidebar'

describe('Sidebar taxonomy navigation',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('starts folded and opens a security through the taxonomy tree',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.setAssignedTags(security.id,[software.id])

    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()}/></AppProvider>)

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

    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()}/></AppProvider>)
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
    render(<AppProvider repository={repository}><Sidebar onNewSecurity={vi.fn()} onNewWatchlist={vi.fn()} onNewTaxonomy={vi.fn()}/></AppProvider>)

    expect(await screen.findByText('Recently Viewed')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Apple Inc. — AAPL'})).toBeInTheDocument()
  })
})
