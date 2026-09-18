import { describe,expect,it } from 'vitest'
import type { SecurityPrice } from '../domain/types'
import { priceRangeStart,pricesInRange } from './SecurityPriceChart'

const price=(priceDate:string):SecurityPrice=>({securityId:'security-1',priceDate,close:100,adjustedClose:100,currency:'USD',sourceSymbol:'TEST',fetchedAt:'2026-09-18T00:00:00Z'})

describe('security price chart ranges',()=>{
  it('calculates month, year, and YTD boundaries from the latest available price',()=>{
    expect(priceRangeStart('2026-09-18','1M')).toBe('2026-08-18')
    expect(priceRangeStart('2026-09-18','2Y')).toBe('2024-09-18')
    expect(priceRangeStart('2026-09-18','YTD')).toBe('2026-01-01')
    expect(priceRangeStart('2026-03-31','1M')).toBe('2026-02-28')
  })

  it('keeps prices inside the selected range in chronological order',()=>{
    expect(pricesInRange([price('2025-09-17'),price('2026-09-18'),price('2026-08-18')],'1Y').map((item)=>item.priceDate)).toEqual(['2026-08-18','2026-09-18'])
  })
})
