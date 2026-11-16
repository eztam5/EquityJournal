import type { Security, SecurityPrice } from '../domain/types'
import { priceRangeStart, type PriceRange } from '../components/SecurityPriceChart'

export interface SecurityComparisonPoint {
  date: string
  change: number
}

export interface SecurityComparisonSeries {
  security: Security
  points: SecurityComparisonPoint[]
}

export function buildSecurityComparison(securities: Security[], histories: Record<string, SecurityPrice[]>, range: PriceRange) {
  const prepared = securities.map((security) => ({
    security,
    prices: [...new Map((histories[security.id] ?? [])
      .filter((price) => price.sourceSymbol.toUpperCase() === security.symbol.toUpperCase() && /^\d{4}-\d{2}-\d{2}$/.test(price.priceDate) && Number.isFinite(price.adjustedClose) && price.adjustedClose > 0)
      .map((price) => [price.priceDate, price])).values()].toSorted((left, right) => left.priceDate.localeCompare(right.priceDate)),
  }))
  const ends = prepared.filter(({ prices }) => prices.length >= 2).map(({ prices }) => prices.at(-1)!.priceDate).sort()
  const endDate = ends[0]
  if (!endDate) return { series: prepared.map(({ security }) => ({ security, points: [] as SecurityComparisonPoint[] })), startDate: undefined, endDate: undefined }
  const rangeStart = priceRangeStart(endDate, range)
  const ranged = prepared.map((item) => ({ ...item, visible: item.prices.filter((price) => price.priceDate >= rangeStart && price.priceDate <= endDate) }))
  const starts = ranged.filter(({ visible }) => visible.length >= 2).map(({ visible }) => visible[0].priceDate).sort()
  const startDate = starts.at(-1)
  const series: SecurityComparisonSeries[] = ranged.map(({ security, prices, visible }) => {
    if (!startDate || visible.length < 2) return { security, points: [] }
    // Markets can have different holidays. Use the last available close as of the common start.
    const base = prices.findLast((price) => price.priceDate <= startDate)!.adjustedClose
    const points = [{ date: startDate, change: 0 }, ...visible.filter((price) => price.priceDate > startDate)
      .map((price) => ({ date: price.priceDate, change: (price.adjustedClose / base - 1) * 100 }))]
    const last = points.at(-1)!
    if (last.date < endDate) points.push({ date: endDate, change: last.change })
    return { security, points: points.every((point) => Number.isFinite(point.change)) ? points : [] }
  })
  return { series, startDate, endDate }
}
