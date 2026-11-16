import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, ButtonGroup, Callout, Card, Spinner, Tooltip } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security, SecurityPrice } from '../domain/types'
import { buildSecurityComparison, type SecurityComparisonSeries } from '../utils/securityComparison'
import { notifyPriceHistoryChanged, PRICE_HISTORY_CHANGED_EVENT } from '../utils/priceUpdates'
import { fetchYahooPriceHistory, isTauriDesktop, yahooTimestampDate } from '../utils/yahooFinance'
import { PRICE_RANGES, type PriceRange } from './SecurityPriceChart'

const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
const dateValue = (date: string) => Date.parse(`${date}T00:00:00Z`)
const seriesDash = (index: number) => index < 8 ? undefined : `${4 + Math.floor(index / 8) * 2} 3`

function ComparisonSvg({ series, startDate, endDate, colorIndex }: { series: SecurityComparisonSeries[]; startDate: string; endDate: string; colorIndex(id: string): number }) {
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 1000, height: 320 })
  useEffect(() => {
    const element = svg.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width > 146 && height > 70) setSize((current) => current.width === width && current.height === height ? current : { width, height })
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  let minimum = 0, maximum = 0
  for (const item of series) for (const point of item.points) { minimum = Math.min(minimum, point.change); maximum = Math.max(maximum, point.change) }
  const padding = Math.max((maximum - minimum) * .08, 1)
  const min = minimum - padding, max = maximum + padding
  const left = 65, right = 20, top = 25, bottom = 34
  const plotWidth = size.width - left - right, plotHeight = size.height - top - bottom
  const firstDate = dateValue(startDate), lastDate = dateValue(endDate), span = Math.max(lastDate - firstDate, 1)
  const x = (date: string) => left + (dateValue(date) - firstDate) / span * plotWidth
  const y = (value: number) => top + (max - value) / (max - min) * plotHeight
  const tickCount = size.width < 500 ? 3 : 5
  const formatDate = new Intl.DateTimeFormat(undefined, span > 180 * 86_400_000 ? { month: 'short', year: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return <svg ref={svg} className="security-price-svg security-comparison-svg" viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Selected securities price comparison, percentage change from a common starting date">
    <title>Adjusted closing price changes from {startDate} through {endDate}</title>
    {Array.from({ length: 5 }, (_, index) => {
      const value = max - (max - min) * index / 4
      return <g key={index}><line className="price-grid-line" x1={left} x2={size.width - right} y1={y(value)} y2={y(value)}/><text className="price-axis-label" x={left - 10} y={y(value) + 4} textAnchor="end">{percent(value)}</text></g>
    })}
    <line className="comparison-zero-line" x1={left} x2={size.width - right} y1={y(0)} y2={y(0)}/>
    {series.filter((item) => item.points.length >= 2).map((item) => {
      const index = colorIndex(item.security.id)
      const path = item.points.map((point, position) => `${position ? 'L' : 'M'}${x(point.date).toFixed(1)},${y(point.change).toFixed(1)}`).join(' ')
      const last = item.points.at(-1)!
      const style = { '--series-color': `var(--comparison-color-${index % 8})`, strokeDasharray: seriesDash(index) } as CSSProperties
      return <g key={item.security.id} style={style}><path className="comparison-price-line" data-security-id={item.security.id} d={path}><title>{item.security.symbol} — {item.security.name}: {percent(last.change)}</title></path><circle className="comparison-price-end" cx={x(last.date)} cy={y(last.change)} r="3"><title>{item.security.symbol}: {percent(last.change)} through {endDate}</title></circle></g>
    })}
    {Array.from({ length: tickCount }, (_, index) => {
      const ratio = index / (tickCount - 1)
      return <text className="price-axis-label" key={index} x={left + ratio * plotWidth} y={size.height - 8} textAnchor={index === 0 ? 'start' : index === tickCount - 1 ? 'end' : 'middle'}>{formatDate.format(firstDate + ratio * span)}</text>
    })}
    <text className="price-axis-title" x="12" y="16">Change</text>
  </svg>
}

export function SecurityComparisonChart({ securities, range, onRangeChange }: { securities: Security[]; range: PriceRange; onRangeChange(range: PriceRange): void }) {
  const app = useApp()
  const [histories, setHistories] = useState<Record<string, SecurityPrice[]>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedKey, setLoadedKey] = useState('')
  const request = useRef(0)
  const publishing = useRef(false)
  const colors = useRef(new Map<string, number>())
  const selectionKey = securities.map((security) => `${security.id}:${security.symbol}:${security.currency}`).join('|')
  const colorIndex = (id: string) => {
    if (!colors.current.has(id)) colors.current.set(id, colors.current.size)
    return colors.current.get(id)!
  }
  securities.forEach((security) => colorIndex(security.id))

  const load = useCallback(async (force = false, cachedOnly = false) => {
    const current = ++request.current
    setLoading(true)
    setErrors([])
    const results: Array<{ security: Security; prices: SecurityPrice[]; updated: boolean; error?: string }> = []
    for (let offset = 0; offset < securities.length; offset += 4) {
      if (request.current !== current) return
      results.push(...await Promise.all(securities.slice(offset, offset + 4).map(async (security) => {
        let cached: SecurityPrice[] = []
        try {
          cached = (await app.repository.listSecurityPrices(security.id)).filter((price) => price.sourceSymbol.toUpperCase() === security.symbol.toUpperCase())
          if (cachedOnly || (!force && (cached.length >= 2 || !isTauriDesktop()))) return { security, prices: cached, updated: false }
          const history = await fetchYahooPriceHistory(security.symbol, '10y')
          const prices = await app.repository.saveSecurityPrices(security.id, security.symbol, history.currency || security.currency, history.prices.map((price) => ({ priceDate: yahooTimestampDate(price.timestamp, history.timeZone), close: price.close, adjustedClose: price.adjustedClose })))
          return { security, prices, updated: true }
        } catch (reason) { return { security, prices: cached, updated: false, error: `${security.symbol}: ${reason instanceof Error ? reason.message : String(reason)}` } }
      })))
    }
    if (request.current !== current) return
    setHistories(Object.fromEntries(results.map((item) => [item.security.id, item.prices])))
    setErrors(results.flatMap((item) => item.error ? [item.error] : []))
    setLoadedKey(selectionKey)
    setLoading(false)
    publishing.current = true
    try { notifyPriceHistoryChanged(results.filter((item) => item.updated).map((item) => item.security.id)) }
    finally { publishing.current = false }
  }, [app.repository, securities, selectionKey])

  useEffect(() => { void load(); return () => { request.current++ } }, [load])
  useEffect(() => {
    const refresh = (event: Event) => {
      if (publishing.current) return
      const ids = (event as CustomEvent<{ securityIds: string[] }>).detail?.securityIds
      if (ids?.some((id) => securities.some((security) => security.id === id))) void load(false, true)
    }
    window.addEventListener(PRICE_HISTORY_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(PRICE_HISTORY_CHANGED_EVENT, refresh)
  }, [load, securities])

  const comparison = useMemo(() => buildSecurityComparison(securities, histories, range), [securities, histories, range])
  const ready = loadedKey === selectionKey
  const hasLines = comparison.series.some((item) => item.points.length >= 2)
  return <Card className="content-panel price-chart-card security-comparison-chart" elevation={0}>
    <header><div><h2>Price comparison</h2><p><small>Percentage change · common starting date</small></p></div><div className="price-chart-actions"><ButtonGroup className="price-range-buttons" aria-label="Price chart range">{PRICE_RANGES.map((item) => <Button key={item} text={item} active={range === item} small onClick={() => onRangeChange(item)}/>)}</ButtonGroup><Tooltip content="Refresh selected securities from Yahoo Finance" hoverOpenDelay={500}><Button icon="refresh" minimal aria-label="Refresh prices" loading={loading} onClick={() => void load(true)}/></Tooltip></div></header>
    {errors.length > 0 && <Callout className="price-chart-message" intent="warning" icon="warning-sign">{errors.join('; ')}</Callout>}
    {!ready ? <div className="price-chart-loading"><Spinner size={24}/><span>Loading price comparison…</span></div> : <>
      <ul className="comparison-legend" aria-label="Comparison legend">{comparison.series.map((item) => {
        const index = colorIndex(item.security.id)
        return <li key={item.security.id} title={`${item.security.symbol} — ${item.security.name}`}>
          <svg className="comparison-legend-swatch" width="20" height="12" aria-hidden="true"><line x1="0" x2="20" y1="6" y2="6" style={{ stroke: `var(--comparison-color-${index % 8})`, strokeDasharray: seriesDash(index) }}/></svg>
          <span>{item.security.symbol}</span><span className="comparison-legend-value">{item.points.length ? percent(item.points.at(-1)!.change) : 'Not enough history'}</span>
        </li>
      })}</ul>
      {hasLines && comparison.startDate && comparison.endDate ? <ComparisonSvg series={comparison.series} startDate={comparison.startDate} endDate={comparison.endDate} colorIndex={colorIndex}/> : <div className="price-chart-empty">Not enough overlapping price history for this range. Refresh to load historical prices.</div>}
    </>}
    <footer><span>{hasLines && ready ? `Adjusted closes rebased to 0% on ${comparison.startDate}, through ${comparison.endDate}. Uses the last available close on each date.` : 'Source: Yahoo Finance. Prices are cached locally.'}</span></footer>
  </Card>
}
