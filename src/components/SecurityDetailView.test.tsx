import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('lists, searches, and edits managed PDF metadata in the Documents tab',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',name:'Nestlé',currency:'CHF'})
    await repository.addSecurityDocument({id:'doc-1',securityId:security.id,title:'UBS initiation report',originalFilename:'ubs-initiation.pdf',storagePath:`attachments/securities/${security.id}/doc-1.pdf`,source:'UBS',documentDate:'2026-06-30',mimeType:'application/pdf',fileSize:2_500_000,sha256:'hash-1'})
    await repository.addSecurityDocument({id:'doc-2',securityId:security.id,title:'Quarterly update',originalFilename:'quarterly.pdf',storagePath:`attachments/securities/${security.id}/doc-2.pdf`,source:'ZKB',documentDate:'2026-08-01',mimeType:'application/pdf',fileSize:400_000,sha256:'hash-2'})
    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('tab',{name:'Documents (2)'}))
    expect(await screen.findByText('UBS initiation report')).toBeInTheDocument()
    expect(screen.getByText('Quarterly update')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox',{name:'Search documents'}),{target:{value:'UBS'}})
    expect(screen.getByText('UBS initiation report')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly update')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button',{name:'Edit UBS initiation report'}))
    const dialog=screen.getByRole('dialog',{name:'Edit document details'})
    expect(within(dialog).queryByLabelText('Document type')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Title'),{target:{value:'Updated bank report'}})
    fireEvent.change(within(dialog).getByLabelText(/^Source/),{target:{value:'UBS Research'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(screen.getByText('Updated bank report')).toBeInTheDocument())
    expect((await repository.listSecurityDocuments(security.id)).find((document)=>document.id==='doc-1')).toEqual(expect.objectContaining({title:'Updated bank report',source:'UBS Research'}))
  })
})
