import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { localPriceDate, SecuritiesView } from './SecuritiesView'
import { PRICE_HISTORY_CHANGED_EVENT } from '../utils/priceUpdates'

function WatchlistViewHarness({watchlistId}:{watchlistId:string}) {
  const app=useApp()
  return <><button onClick={()=>app.setView({type:'watchlist',id:watchlistId})}>Open watchlist</button><SecuritiesView watchlistId={watchlistId}/></>
}

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
    expect(screen.getAllByRole('columnheader').map((header)=>header.textContent)).toEqual(['Symbol','Company','Yahoo Finance','Currency','Today %',''])
    expect(JSON.parse(localStorage.getItem('equity-journal.visible-security-columns')??'{}')).toEqual({order:['symbol','alternativeId','name','link:yahoo','currency','todayChange'],visible:['symbol','name','currency','todayChange','link:yahoo'],version:2})
  })

  it('does not allow hiding the final visible column',async()=>{
    localStorage.setItem('equity-journal.visible-security-columns',JSON.stringify({order:['symbol','alternativeId','name','currency','todayChange'],visible:['symbol'],version:2}))
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    fireEvent.click(screen.getByRole('button',{name:'Columns'}))
    const menu=await screen.findByRole('menu',{name:'Visible columns'})
    expect(within(menu).getByRole('menuitemcheckbox',{name:'Symbol'})).toHaveAttribute('aria-disabled','true')
  })

  it('opens edit and delete actions from the row menu',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    const actions=await screen.findByRole('button',{name:'Actions for Apple Inc.'})
    expect(screen.queryByRole('button',{name:'Edit Apple Inc.'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Delete Apple Inc.'})).not.toBeInTheDocument()
    fireEvent.click(actions)
    let menu=await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
    fireEvent.click(within(menu).getByRole('menuitem',{name:'Edit security'}))
    const editDialog=screen.getByRole('dialog',{name:'Edit security'})
    expect(within(editDialog).getByLabelText('Symbol')).toHaveValue('AAPL')
    fireEvent.click(within(editDialog).getByRole('button',{name:'Cancel'}))

    fireEvent.click(actions)
    menu=await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem',{name:'Delete security'}))
    expect(screen.getByRole('dialog',{name:'Delete security'})).toBeInTheDocument()
  })

  it('opens the new security dialog from the All Securities toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    fireEvent.click(screen.getByRole('button',{name:'New security'}))

    expect(screen.getByRole('dialog',{name:'New security'})).toBeInTheDocument()
  })

  it('creates a security in the currently open watchlist from the toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const watchlist=await repository.addWatchlist('Quality')
    render(<AppProvider repository={repository}><WatchlistViewHarness watchlistId={watchlist.id}/></AppProvider>)

    fireEvent.click(screen.getByRole('button',{name:'Open watchlist'}))
    fireEvent.click(screen.getByRole('button',{name:'New security'}))
    const dialog=screen.getByRole('dialog',{name:'New security'})
    fireEvent.change(within(dialog).getByLabelText('Company name'),{target:{value:'Apple Inc.'}})
    fireEvent.change(within(dialog).getByLabelText('Symbol'),{target:{value:'AAPL'}})
    fireEvent.change(within(dialog).getByLabelText('Currency'),{target:{value:'USD'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'New security'})).not.toBeInTheDocument())
    expect((await repository.listSecurities(watchlist.id)).map((security)=>security.symbol)).toEqual(['AAPL'])
  })

  it('removes a security from a watchlist without deleting it',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    await repository.setWatchlistSecurity(watchlist.id,security.id,true)
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Actions for Apple Inc.'}))
    const menu=await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3)
    expect(within(menu).getByRole('menuitem',{name:'Edit'})).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem',{name:'Delete security'})).toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('menuitem',{name:'Remove from watchlist'}))

    await waitFor(()=>expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog',{name:'Remove from watchlist'})).not.toBeInTheDocument()
    expect(await repository.listSecurities(watchlist.id)).toEqual([])
    expect(await repository.listSecurities()).toEqual([security])
  })

  it('offers permanent security deletion from a watchlist menu',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    await repository.setWatchlistSecurity(watchlist.id,security.id,true)
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Actions for Apple Inc.'}))
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem',{name:'Delete security'}))

    expect(screen.getByRole('dialog',{name:'Delete security'})).toBeInTheDocument()
    expect(screen.getByText(/permanently delete Apple Inc. from the database/i)).toBeInTheDocument()
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

    await waitFor(()=>expect(writeText).toHaveBeenCalledWith('Symbol,Alternative ID,Company,Currency,Today %\r\nAAPL,US0378331005,Apple Inc.,USD,0.00%\r\nMSFT,US5949181045,Microsoft,USD,0.00%'))
    expect(await screen.findByRole('status')).toHaveTextContent('CSV copied to clipboard')
  })

  it('shows and refreshes today’s percentage change using stored closes',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'}),today=localPriceDate(),previousDate=new Date(`${today}T12:00:00Z`)
    previousDate.setUTCDate(previousDate.getUTCDate()-1)
    const previous=previousDate.toISOString().slice(0,10)
    await repository.saveSecurityPrices(security.id,'AAPL','USD',[{priceDate:previous,close:100,adjustedClose:100},{priceDate:today,close:105,adjustedClose:105}])
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    expect(await screen.findByText('+5.00%')).toHaveClass('positive')
    await repository.saveSecurityPrices(security.id,'AAPL','USD',[{priceDate:today,close:95,adjustedClose:95}])
    window.dispatchEvent(new CustomEvent(PRICE_HISTORY_CHANGED_EVENT,{detail:{securityIds:[security.id]}}))

    expect(await screen.findByText('-5.00%')).toHaveClass('negative')
  })

  it('filters All Securities by symbol or company name without querying again',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    const listSecurities=vi.spyOn(repository,'listSecurities')
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    const initialQueries=listSecurities.mock.calls.length
    const search=screen.getByRole('searchbox',{name:'Search securities'})
    fireEvent.change(search,{target:{value:'micro'}})
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    fireEvent.change(search,{target:{value:'aapl'}})
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.queryByText('Microsoft')).not.toBeInTheDocument()
    expect(listSecurities).toHaveBeenCalledTimes(initialQueries)

    fireEvent.click(screen.getByRole('button',{name:'Clear search'}))
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
  })

  it('filters only the securities belonging to the current watchlist',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const microsoft=await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    await repository.addSecurity({symbol:'NVDA',name:'Nvidia',currency:'USD'})
    const watchlist=await repository.addWatchlist('Quality')
    await repository.setWatchlistSecurity(watchlist.id,apple.id,true)
    await repository.setWatchlistSecurity(watchlist.id,microsoft.id,true)
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    expect(screen.queryByText('Nvidia')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox',{name:'Search securities'}),{target:{value:'MSFT'}})
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Clear search'}))
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('Microsoft')).toBeInTheDocument()
    expect(screen.queryByText('Nvidia')).not.toBeInTheDocument()
  })

})
