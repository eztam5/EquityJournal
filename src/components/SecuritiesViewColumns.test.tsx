import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecuritiesView } from './SecuritiesView'

describe('SecuritiesView visible columns',()=>{
  afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()})

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

  it('shows direct edit and delete actions for every security',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Edit Apple Inc.'}))
    const editDialog=screen.getByRole('dialog',{name:'Edit security'})
    expect(within(editDialog).getByLabelText('Symbol')).toHaveValue('AAPL')
    fireEvent.click(within(editDialog).getByRole('button',{name:'Cancel'}))

    fireEvent.click(screen.getByRole('button',{name:'Delete Apple Inc.'}))
    expect(screen.getByRole('dialog',{name:'Delete security'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Actions for Apple Inc.'})).not.toBeInTheDocument()
  })

  it('removes a security from a watchlist without deleting it',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    await repository.setWatchlistSecurity(watchlist.id,security.id,true)
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)

    const removeButton=await screen.findByRole('button',{name:'Remove Apple Inc.'})
    fireEvent.mouseEnter(removeButton)
    expect(await screen.findByText(/security itself will not be deleted/i)).toBeInTheDocument()
    fireEvent.click(removeButton)

    await waitFor(()=>expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog',{name:'Remove from watchlist'})).not.toBeInTheDocument()
    expect(await repository.listSecurities(watchlist.id)).toEqual([])
    expect(await repository.listSecurities()).toEqual([security])
  })

  it('exports visible columns and sorted rows as CSV to the clipboard',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'MSFT',alternativeId:'US5949181045',name:'Microsoft',currency:'USD'})
    await repository.addSecurity({symbol:'AAPL',alternativeId:'US0378331005',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Export'}))
    fireEvent.click(await screen.findByRole('menuitem',{name:'Export as CSV to Clipboard'}))

    await waitFor(()=>expect(writeText).toHaveBeenCalledWith('Symbol,Alternative ID,Company,Currency\r\nAAPL,US0378331005,Apple Inc.,USD\r\nMSFT,US5949181045,Microsoft,USD'))
    expect(await screen.findByRole('status')).toHaveTextContent('CSV copied to clipboard')
  })

})
