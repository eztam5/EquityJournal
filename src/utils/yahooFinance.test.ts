import { describe,expect,it } from 'vitest'
import { yahooTimestampDate } from './yahooFinance'

describe('Yahoo Finance price conversion',()=>{
  it('converts daily timestamps to database dates',()=>{
    expect(yahooTimestampDate(Date.UTC(2026,8,17,13,30)/1000)).toBe('2026-09-17')
    expect(yahooTimestampDate(Date.UTC(2026,8,16,22,0)/1000,'Pacific/Auckland')).toBe('2026-09-17')
  })
})
