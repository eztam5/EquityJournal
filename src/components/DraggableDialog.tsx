import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Button, Card } from '@blueprintjs/core'

export function DraggableDialog({ title, children, onClose, width = 480 }: { title: string; children: ReactNode; onClose(): void; width?: number }) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(() => ({ x: Math.max(24, (innerWidth - width) / 2), y: Math.max(48, innerHeight * .16) }))
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey)
  }, [onClose])
  const startDrag = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    const start = { pointerX: event.clientX, pointerY: event.clientY,
                    panelX: position.x, panelY: position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
    const move = (next: globalThis.PointerEvent) => setPosition({
      x: Math.min(innerWidth - 160, Math.max(0, start.panelX + next.clientX - start.pointerX)),
      y: Math.min(innerHeight - 70, Math.max(0, start.panelY + next.clientY - start.pointerY)),
    })
    const end = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', end) }
    addEventListener('pointermove', move); addEventListener('pointerup', end)
  }
  return <Card ref={panel} className="floating-dialog" role="dialog" aria-modal="false" aria-label={title} style={{ width, left: position.x, top: position.y }} elevation={3}>
    <header className="dialog-titlebar" onPointerDown={startDrag}><strong>{title}</strong><Button variant="minimal" icon="cross" size="small" onClick={onClose} aria-label="Close"/></header>
    <div className="dialog-body">{children}</div>
  </Card>
}

export function DialogActions({ children }: { children: ReactNode }) { return <div className="dialog-actions">{children}</div> }
