import { cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,describe,expect,it,vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { fetchYahooPriceHistory } from '../utils/yahooFinance'
import { SecurityForm } from './Forms'

vi.mock('../utils/yahooFinance',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('../utils/yahooFinance')>()
  return {...actual,fetchYahooPriceHistory:vi.fn()}
})

describe('SecurityForm price validation',()=>{
  afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks()})

  it('tests the entered Yahoo symbol and displays a mini chart',async()=>{
    vi.mocked(fetchYahooPriceHistory).mockResolvedValue({symbol:'AAPL',companyName:'Apple Inc.',exchangeName:'NMS',timeZone:'America/New_York',currency:'USD',prices:[{timestamp:Date.UTC(2026,8,16)/1000,close:230,adjustedClose:230},{timestamp:Date.UTC(2026,8,17)/1000,close:232,adjustedClose:232}]})
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><SecurityForm onClose={()=>{}}/></AppProvider>)

    fireEvent.change(screen.getByLabelText('Symbol'),{target:{value:'AAPL'}})
    fireEvent.click(screen.getByRole('button',{name:'Test prices'}))

    expect(await screen.findByLabelText('Yahoo Finance price preview')).toHaveTextContent('Apple Inc.')
    expect(screen.getByRole('img',{name:'Price preview'})).toBeInTheDocument()
    expect(fetchYahooPriceHistory).toHaveBeenCalledWith('AAPL','1mo')
  })
})
