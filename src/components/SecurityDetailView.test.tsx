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
})
