import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecuritiesView } from './SecuritiesView'

describe('SecuritiesView visible columns',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('hides selected columns and persists the preference',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',alternativeId:'US0378331005',name:'Apple Inc.',currency:'USD'})
    await repository.saveSecurityLinkTemplates([{id:'yahoo',linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0}])
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button',{name:'Columns'}))
    const menu=await screen.findByRole('menu',{name:'Visible columns'})
    fireEvent.click(within(menu).getByRole('menuitemcheckbox',{name:'Alternative ID'}))

    await waitFor(()=>expect(screen.queryByRole('columnheader',{name:/Alternative ID/})).not.toBeInTheDocument())
    expect(screen.queryByText('US0378331005')).not.toBeInTheDocument()
    fireEvent.click(await within(menu).findByRole('menuitemcheckbox',{name:'Yahoo Finance'}))
    expect(await screen.findByRole('columnheader',{name:'Yahoo Finance'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Open Yahoo Finance'})).toBeInTheDocument()

    fireEvent.click(within(menu).getByRole('button',{name:'Move Yahoo Finance up'}))
    fireEvent.click(within(menu).getByRole('button',{name:'Move Yahoo Finance up'}))
    expect(screen.getAllByRole('columnheader').map((header)=>header.textContent)).toEqual(['Symbol','Yahoo Finance','Company','Currency',''])
    expect(JSON.parse(localStorage.getItem('equity-journal.visible-security-columns')??'{}')).toEqual({order:['symbol','alternativeId','link:yahoo','name','currency'],visible:['symbol','name','currency','link:yahoo']})
  })

  it('does not allow hiding the final visible column',async()=>{
    localStorage.setItem('equity-journal.visible-security-columns',JSON.stringify({order:['symbol','alternativeId','name','currency'],visible:['symbol']}))
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    fireEvent.click(screen.getByRole('button',{name:'Columns'}))
    const menu=await screen.findByRole('menu',{name:'Visible columns'})
    expect(within(menu).getByRole('menuitemcheckbox',{name:'Symbol'})).toHaveAttribute('aria-disabled','true')
  })

})
