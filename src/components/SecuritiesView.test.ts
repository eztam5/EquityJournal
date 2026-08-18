import { describe, expect, it } from 'vitest'
import type { Security } from '../domain/types'
import { loadVisibleSecurityColumns, sortSecurities } from './SecuritiesView'

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
  })
  it('loads valid visible-column preferences in table order',()=>{
    localStorage.setItem('equity-journal.visible-security-columns',JSON.stringify(['currency','link:yahoo','unknown','symbol']))
    expect(loadVisibleSecurityColumns()).toEqual(['symbol','currency','link:yahoo'])
  })
})
