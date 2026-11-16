import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Button } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { SecurityPriceChart, type PriceRange } from './SecurityPriceChart'
import { SecurityComparisonChart } from './SecurityComparisonChart'

const HEIGHT_KEY = 'equity-journal.watchlist-chart-height.v1'
const DEFAULT_HEIGHT = 360
const MIN_HEIGHT = 240
const MAX_HEIGHT = 720
const LIST_MIN_HEIGHT = 160
const HANDLE_HEIGHT = 6

function loadHeight() {
  try {
    const saved = localStorage.getItem(HEIGHT_KEY)
    const height = saved === null ? DEFAULT_HEIGHT : Number(saved)
    return Number.isFinite(height) ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)) : DEFAULT_HEIGHT
  } catch { return DEFAULT_HEIGHT }
}

export function WatchlistChartWorkspace({ securities, onClose, children }: { securities: Security[]; onClose(): void; children: ReactNode }) {
  const app = useApp()
  const [preferredHeight, setPreferredHeight] = useState(loadHeight)
  const [availableHeight, setAvailableHeight] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const [range, setRange] = useState<PriceRange>('1Y')
  const security = securities.length === 1 ? securities[0] : undefined
  const hasSelection = securities.length > 0
  const workspace = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null)
  const chartId = useId()
  const maxHeight = availableHeight === null ? MAX_HEIGHT : Math.max(160, Math.min(MAX_HEIGHT, availableHeight - LIST_MIN_HEIGHT - HANDLE_HEIGHT))
  const minHeight = Math.min(MIN_HEIGHT, maxHeight)
  const height = Math.min(maxHeight, Math.max(minHeight, preferredHeight))

  useEffect(() => {
    try { localStorage.setItem(HEIGHT_KEY, String(preferredHeight)) }
    catch { /* Resizing remains available when preferences cannot be saved. */ }
  }, [preferredHeight])

  useEffect(() => {
    const element = workspace.current
    if (!element) return
    const measure = () => {
      const measured = element.getBoundingClientRect().height
      if (measured > 0) setAvailableHeight(measured)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  useEffect(() => {
    if (!hasSelection) { drag.current = null; setResizing(false) }
  }, [hasSelection])

  const resizeTo = (next: number) => setPreferredHeight(Math.min(maxHeight, Math.max(minHeight, Math.round(next))))
  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: height }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setResizing(true)
  }
  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.preventDefault()
    resizeTo(current.startHeight + current.startY - event.clientY)
  }
  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16
    const next = event.key === 'ArrowUp' ? height + step : event.key === 'ArrowDown' ? height - step : event.key === 'Home' ? minHeight : event.key === 'End' ? maxHeight : null
    if (next === null) return
    event.preventDefault()
    resizeTo(next)
  }

  return <div ref={workspace} className={`watchlist-chart-workspace${resizing ? ' is-resizing' : ''}`} style={{ '--watchlist-chart-height': `${height}px` } as CSSProperties}>
    {children}
    {hasSelection && <>
      <div className="watchlist-chart-resizer" role="separator" tabIndex={0} aria-label="Resize price chart panel" aria-orientation="horizontal" aria-controls={chartId} aria-valuemin={minHeight} aria-valuemax={maxHeight} aria-valuenow={height} aria-valuetext={`${height} pixels`}
        title="Drag to resize. Double-click to reset height." onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize} onKeyDown={resizeWithKeyboard} onDoubleClick={() => resizeTo(DEFAULT_HEIGHT)}/>
      <section id={chartId} className="watchlist-chart-panel" aria-labelledby={`${chartId}-title`}>
        <header className="watchlist-chart-titlebar"><h2 id={`${chartId}-title`}>{security ? `${security.symbol} — ${security.name}` : `Compare ${securities.length} securities`}</h2><Button variant="minimal" size="small" icon="cross" aria-label="Close price chart" title="Close price chart" onClick={onClose}/></header>
        {security ? <SecurityPriceChart key={security.id} security={security} range={range} onRangeChange={setRange} onJournalEntryClick={(entry) => app.openSecurity(security.id, entry.id)}/> : <SecurityComparisonChart securities={securities} range={range} onRangeChange={setRange}/>}
      </section>
    </>}
  </div>
}
