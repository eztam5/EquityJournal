import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecurityDetailView } from './SecurityDetailView'

describe('SecurityDetailView research notes',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('loads the note belonging to each security when navigating between them',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const microsoft=await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    await repository.saveNote(apple.id,'<p>Apple thesis</p>')
    await repository.saveNote(microsoft.id,'<p>Microsoft thesis</p>')

    const view=render(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={microsoft.id}/></AppProvider>)
    expect(await screen.findByText('Microsoft thesis')).toBeInTheDocument()
    expect(screen.queryByText('Apple thesis')).not.toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()
    expect(screen.queryByText('Microsoft thesis')).not.toBeInTheDocument()
  })

  it('shows dated journal entries separately from the current thesis',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',name:'Nestlé',currency:'CHF'})
    await repository.saveNote(security.id,'<p>Current thesis text</p>')
    await repository.saveJournalEntry({securityId:security.id,entryDate:'2026-08-18',contentHtml:'<p>Half-year report review</p>'})

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)
    expect(await screen.findByText('Current thesis text')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab',{name:'Journal'}))

    expect(await screen.findByText('Half-year report review')).toBeInTheDocument()
    expect(screen.queryByText('Current thesis text')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-08-18')).toBeInTheDocument()
  })

  it('shows configured external links with the security alternative ID',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',alternativeId:'US0378331005',name:'Apple Inc.',currency:'USD'})
    await repository.saveSecurityLinkTemplates([{id:'yahoo',linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0}])

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    expect(await screen.findByRole('button',{name:'Yahoo Finance'})).toBeInTheDocument()
    expect(screen.getByText('US0378331005')).toBeInTheDocument()
  })

  it('opens the existing edit-security dialog from the detail header',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Edit security'}))

    expect(screen.getByRole('dialog',{name:'Edit security'})).toBeInTheDocument()
    expect(screen.getByLabelText('Symbol')).toHaveValue('AAPL')
    expect(screen.getByLabelText('Company name')).toHaveValue('Apple Inc.')
  })

  it('shows assigned tags with their parent path but without the taxonomy name',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NEM',name:'Newmont',currency:'USD'})
    const taxonomy=await repository.addTaxonomy({name:'Asset Allocation',description:'',color:'#4F7CAC'})
    const materials=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Materials',description:'',color:taxonomy.color})
    const metals=await repository.addTag({taxonomyId:taxonomy.id,parentId:materials.id,name:'Precious Metals',description:'',color:taxonomy.color})
    const gold=await repository.addTag({taxonomyId:taxonomy.id,parentId:metals.id,name:'Gold',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[gold.id])

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    expect(await screen.findByText('Materials ▸ Precious Metals ▸ Gold')).toBeInTheDocument()
    expect(screen.getByRole('heading',{name:'Asset Allocation'})).toBeInTheDocument()
    expect(screen.queryByText('Asset Allocation › Materials › Precious Metals › Gold')).not.toBeInTheDocument()
  })
})
