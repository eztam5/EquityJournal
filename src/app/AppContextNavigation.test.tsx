import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalRepository } from '../data/localRepository'
import { PageHeader } from '../components/PageHeader'
import { AppProvider, useApp } from './AppContext'

function NavigationHarness() {
  const app=useApp()
  return <><PageHeader title={app.view.type}/><span data-testid="view">{app.view.type}{'id'in app.view?`:${app.view.id}`:''}</span><button onClick={()=>app.setView({type:'topics'})}>Topics</button><button onClick={()=>app.setView({type:'taxonomy',id:'taxonomy-1'})}>Taxonomy</button></>
}

function AddSecurityHarness({watchlistId}:{watchlistId:string}) {
  const app=useApp()
  return <><button onClick={()=>app.setView({type:'watchlist',id:watchlistId})}>Open watchlist</button><button onClick={()=>void app.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})}>Add security</button></>
}

describe('view navigation history',()=>{
  afterEach(cleanup)

  it('returns through previously visited views',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><NavigationHarness/></AppProvider>)
    const back=screen.getByRole('button',{name:'Back'})
    expect(back).toBeDisabled()

    fireEvent.click(screen.getByRole('button',{name:'Topics'}))
    fireEvent.click(screen.getByRole('button',{name:'Taxonomy'}))
    expect(screen.getByTestId('view')).toHaveTextContent('taxonomy:taxonomy-1')

    fireEvent.click(back)
    expect(screen.getByTestId('view')).toHaveTextContent('topics')
    fireEvent.click(back)
    expect(screen.getByTestId('view')).toHaveTextContent('all-securities')
    expect(back).toBeDisabled()
  })

  it('adds a new security to the currently open watchlist',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const watchlist=await repository.addWatchlist('Quality')
    render(<AppProvider repository={repository}><AddSecurityHarness watchlistId={watchlist.id}/></AppProvider>)

    fireEvent.click(screen.getByRole('button',{name:'Open watchlist'}))
    fireEvent.click(screen.getByRole('button',{name:'Add security'}))

    await waitFor(async()=>expect(await repository.listSecurities(watchlist.id)).toHaveLength(1))
    expect((await repository.listSecurities(watchlist.id))[0].symbol).toBe('AAPL')
  })
})
