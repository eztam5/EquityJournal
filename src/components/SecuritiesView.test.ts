import { describe, expect, it } from 'vitest'
import type { Security } from '../domain/types'
import type { SecurityPrice } from '../domain/types'
import { formatTodayPriceChange, loadSecurityColumnPreferences, loadVisibleSecurityColumns, sortSecurities, todayPriceChange } from './SecuritiesView'

const rows:Security[]=[
  {id:'2',symbol:'MSFT',alternativeId:'US5949181045',name:'Microsoft',currency:'USD'},
  {id:'1',symbol:'NESN',alternativeId:'CH0038863350',name:'Nestlé',currency:'CHF'},
  {id:'3',symbol:'AAPL',alternativeId:'US0378331005',name:'Apple',currency:'USD'},
]

describe('sortSecurities',()=>{
  it('sorts each security column in both directions',()=>{
    expect(sortSecurities(rows,'symbol','asc').map((row)=>row.symbol)).toEqual(['AAPL','MSFT','NESN'])
    expect(sortSecurities(rows,'alternativeId','desc').map((row)=>row.symbol)).toEqual(['MSFT','AAPL','NESN'])
    expect(sortSecurities(rows,'name','desc').map((row)=>row.name)).toEqual(['Nestlé','Microsoft','Apple'])
    expect(sortSecurities(rows,'currency','asc').map((row)=>row.currency)).toEqual(['CHF','USD','USD'])
    expect(sortSecurities(rows,'todayChange','asc',{1:2.5,2:-1,3:0}).map((row)=>row.symbol)).toEqual(['MSFT','AAPL','NESN'])
    expect(sortSecurities(rows,'todayChange','desc',{1:2.5,2:-1,3:0}).map((row)=>row.symbol)).toEqual(['NESN','AAPL','MSFT'])
  })
  it('loads valid visible-column preferences in table order',()=>{
    localStorage.setItem('equity-journal.visible-security-columns',JSON.stringify({order:['currency','link:yahoo','symbol'],visible:['currency','link:yahoo','symbol']}))
    expect(loadVisibleSecurityColumns()).toEqual(['currency','link:yahoo','symbol','todayChange'])
  })
  it('loads ordered column preferences',()=>{
    localStorage.setItem('equity-journal.visible-security-columns',JSON.stringify({order:['name','link:yahoo','symbol'],visible:['link:yahoo','name']}))
    expect(loadSecurityColumnPreferences()).toEqual({order:['name','link:yahoo','symbol','alternativeId','currency','todayChange'],visible:['link:yahoo','name','todayChange'],version:2})
  })
})

describe('todayPriceChange',()=>{
  const price=(priceDate:string,close:number):SecurityPrice=>({securityId:'security-1',priceDate,close,adjustedClose:close,currency:'USD',sourceSymbol:'TEST',fetchedAt:'2026-09-18T12:00:00Z'})

  it('compares today with the preceding trading-day close',()=>{
    expect(todayPriceChange([price('2026-09-17',100),price('2026-09-18',105)],'2026-09-18')).toBeCloseTo(5)
    expect(formatTodayPriceChange(5)).toBe('+5.00%')
    expect(formatTodayPriceChange(-2.5)).toBe('-2.50%')
  })

  it('returns a neutral zero when no price exists for today',()=>{
    expect(todayPriceChange([price('2026-09-16',100),price('2026-09-17',105)],'2026-09-18')).toBe(0)
    expect(todayPriceChange([price('2026-09-18',105)],'2026-09-18')).toBe(0)
    expect(formatTodayPriceChange(0)).toBe('0.00%')
  })
})
