import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PriceActivityIndicator } from './PriceActivityIndicator'
import { trackPriceActivity } from '../utils/priceActivity'
import { fetchYahooPriceHistory } from '../utils/yahooFinance'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})

it('stays visible until overlapping operations finish, including failures',async()=>{
  render(<PriceActivityIndicator/>)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  let finish!:()=>void,fail!:(reason:Error)=>void
  let first!:Promise<void>,second!:Promise<void>
  act(()=>{
    first=trackPriceActivity(()=>new Promise<void>((resolve)=>{finish=resolve}))
    second=trackPriceActivity(()=>new Promise<void>((_,reject)=>{fail=reject})).catch(()=>{})
  })
  expect(screen.getByRole('progressbar',{name:'Loading / updating price data'})).toBeInTheDocument()
  await act(async()=>{finish();await first})
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  await act(async()=>{fail(new Error('Offline'));await second})
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('tracks real price fetches and clears the indicator on network failure',async()=>{
  let reject!:(reason:Error)=>void
  vi.stubGlobal('fetch',vi.fn(()=>new Promise((_,fail)=>{reject=fail})))
  render(<PriceActivityIndicator/>)
  let request!:Promise<unknown>
  act(()=>{request=fetchYahooPriceHistory('AAPL').catch(()=>{})})
  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  await act(async()=>{reject(new Error('Offline'));await request})
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})
