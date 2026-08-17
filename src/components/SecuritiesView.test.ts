import { describe, expect, it } from 'vitest'
import type { Security } from '../domain/types'
import { sortSecurities } from './SecuritiesView'

const rows:Security[]=[
  {id:'2',symbol:'MSFT',name:'Microsoft',currency:'USD'},
  {id:'1',symbol:'NESN',name:'Nestlé',currency:'CHF'},
  {id:'3',symbol:'AAPL',name:'Apple',currency:'USD'},
]

describe('sortSecurities',()=>{
  it('sorts each security column in both directions',()=>{
    expect(sortSecurities(rows,'symbol','asc').map((row)=>row.symbol)).toEqual(['AAPL','MSFT','NESN'])
    expect(sortSecurities(rows,'name','desc').map((row)=>row.name)).toEqual(['Nestlé','Microsoft','Apple'])
    expect(sortSecurities(rows,'currency','asc').map((row)=>row.currency)).toEqual(['CHF','USD','USD'])
  })
})
