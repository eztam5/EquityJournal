import { describe, expect, it } from 'vitest'
import type { Security, SecurityPrice } from '../domain/types'
import { buildSecurityComparison } from './securityComparison'

const apple: Security = { id: 'a', symbol: 'AAPL', name: 'Apple', currency: 'USD', alternativeId: '' }
const nestle: Security = { id: 'n', symbol: 'NESN', name: 'Nestlé', currency: 'CHF', alternativeId: '' }
const prices = (security: Security, values: Array<[string, number]>): SecurityPrice[] => values.map(([priceDate, adjustedClose]) => ({ securityId: security.id, sourceSymbol: security.symbol, currency: security.currency, priceDate, close: adjustedClose, adjustedClose, fetchedAt: '' }))

describe('security price comparisons', () => {
  it('compares returns for different nominal prices and currencies', () => {
    const result = buildSecurityComparison([apple, nestle], {
      a: prices(apple, [['2026-08-01', 100], ['2026-09-01', 125]]),
      n: prices(nestle, [['2026-08-01', 1000], ['2026-09-01', 900]]),
    }, '1Y')
    expect(result.series[0].points).toEqual([{ date: '2026-08-01', change: 0 }, { date: '2026-09-01', change: 25 }])
    expect(result.series[1].points[1].change).toBeCloseTo(-10)
  })

  it('uses the same start and end dates despite different market holidays and history lengths', () => {
    const result = buildSecurityComparison([apple, nestle], {
      a: prices(apple, [['2026-01-01', 100], ['2026-01-03', 110], ['2026-01-05', 120], ['2026-01-06', 150]]),
      n: prices(nestle, [['2026-01-02', 200], ['2026-01-04', 220], ['2026-01-05', 240]]),
    }, '1M')
    expect(result.startDate).toBe('2026-01-02')
    expect(result.endDate).toBe('2026-01-05')
    for (const item of result.series) {
      expect(item.points[0]).toEqual({ date: '2026-01-02', change: 0 })
      expect(item.points.at(-1)?.date).toBe('2026-01-05')
      expect(item.points.at(-1)?.change).toBeCloseTo(20)
    }
    expect(result.series[0].points.some((point) => point.date === '2026-01-06')).toBe(false)
  })

  it('applies one selected time range and rebases all eligible companies within it', () => {
    const histories = {
      a: prices(apple, [['2025-01-01', 50], ['2026-08-01', 100], ['2026-09-01', 120], ['2026-09-18', 150]]),
      n: prices(nestle, [['2025-01-01', 200], ['2026-08-01', 300], ['2026-09-01', 360], ['2026-09-18', 450]]),
    }
    const result = buildSecurityComparison([apple, nestle], histories, '1M')
    expect(result.startDate).toBe('2026-09-01')
    for (const item of result.series) expect(item.points.at(-1)?.change).toBeCloseTo(25)
  })

  it('reports unavailable series and excludes invalid prices and stale symbols', () => {
    const result = buildSecurityComparison([apple, nestle], {
      a: [...prices(apple, [['2026-08-01', 100], ['2026-09-01', 125], ['2026-08-03', 0], ['2026-08-04', NaN]]), ...prices({ ...apple, symbol: 'OLD' }, [['2026-08-05', 500]])],
      n: prices(nestle, [['2026-08-01', -1], ['2026-08-02', Infinity]]),
    }, '1Y')
    expect(result.series[0].points.at(-1)?.change).toBe(25)
    expect(result.series[1].points).toEqual([])
    expect(result.series.flatMap((item) => item.points).every((point) => Number.isFinite(point.change))).toBe(true)
  })
})
