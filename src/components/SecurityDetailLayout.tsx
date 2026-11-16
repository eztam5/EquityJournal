import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { Security } from '../domain/types'
import { SecuritySidePanel } from './SecuritySidePanel'

const PREFERENCES_KEY = 'equity-journal.security-details-panel.v1'
const DEFAULT_WIDTH = 280
const MIN_WIDTH = 240
const MAX_WIDTH = 520
const MAIN_MIN_WIDTH = 600
const RESIZE_HANDLE_WIDTH = 6

function loadPreferences(): { width: number; collapsed: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null')
    return {
      width: typeof saved?.width === 'number' && Number.isFinite(saved.width) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved.width)) : DEFAULT_WIDTH,
      collapsed: saved?.collapsed === true,
    }
  } catch {
    return { width: DEFAULT_WIDTH, collapsed: false }
  }
}

export function SecurityDetailLayout({ security, children }: { security: Security; children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadPreferences)
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const layout = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)
  const panelId = useId()
  const stacked = !preferences.collapsed && layoutWidth !== null && layoutWidth < MAIN_MIN_WIDTH + MIN_WIDTH + RESIZE_HANDLE_WIDTH
  const maxWidth = layoutWidth === null ? MAX_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, layoutWidth - MAIN_MIN_WIDTH - RESIZE_HANDLE_WIDTH))
  const width = Math.min(preferences.width, maxWidth)

  useEffect(() => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)) }
    catch { /* Keep panel controls usable when storage is unavailable. */ }
  }, [preferences])

  useEffect(() => {
    const element = layout.current
    if (!element) return
    const measure = () => {
      const measured = element.getBoundingClientRect().width
      if (measured > 0) setLayoutWidth(measured)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const resizeTo = (nextWidth: number) => setPreferences((current) => ({ ...current, width: Math.min(maxWidth, Math.max(MIN_WIDTH, Math.round(nextWidth))) }))
  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stacked || preferences.collapsed) return
    event.preventDefault()
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setResizing(true)
  }
  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    event.preventDefault()
    resizeTo(current.startWidth + current.startX - event.clientX)
  }
  const stopResize = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16
    const nextWidth = event.key === 'ArrowLeft' ? width + step : event.key === 'ArrowRight' ? width - step : event.key === 'Home' ? MIN_WIDTH : event.key === 'End' ? maxWidth : null
    if (nextWidth === null) return
    event.preventDefault()
    resizeTo(nextWidth)
  }

  return <div ref={layout} className={`security-research-layout${preferences.collapsed ? ' is-collapsed' : ''}${stacked ? ' is-stacked' : ''}${resizing ? ' is-resizing' : ''}`} style={{ '--security-details-width': `${width}px` } as CSSProperties}>
    <SecuritySidePanel security={security} id={panelId} collapsed={preferences.collapsed} onToggle={() => setPreferences((current) => ({ ...current, collapsed: !current.collapsed }))}/>
    <div className="security-panel-resize-handle" role="separator" tabIndex={0} aria-label="Resize security details" aria-orientation="vertical" aria-controls={panelId} aria-valuemin={MIN_WIDTH} aria-valuemax={maxWidth} aria-valuenow={width} aria-valuetext={`${width} pixels`} hidden={preferences.collapsed || stacked || layoutWidth === null}
      title="Drag to resize. Double-click to reset width."
      onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} onLostPointerCapture={stopResize}
      onKeyDown={resizeWithKeyboard} onDoubleClick={() => resizeTo(DEFAULT_WIDTH)}/>
    <div className="security-main-column">{children}</div>
  </div>
}
