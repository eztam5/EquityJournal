import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from 'react'
import type { TagDropPosition } from './taxonomyTreeModel'

export type TaxonomyDropOperation =
  | { kind: 'security'; securityId: string; fromTagId: string; toTagId: string; copy: boolean }
  | { kind: 'tag'; tagId: string; targetTagId: string | null; position: TagDropPosition }

export interface TaxonomyDropTarget {
  tagId: string | null
  position: TagDropPosition
}

type DraggedItem =
  | { kind: 'security'; securityId: string; tagId: string }
  | { kind: 'tag'; tagId: string }

interface PendingDrag {
  item: DraggedItem
  pointerId: number
  x: number
  y: number
}

const DRAG_THRESHOLD = 5

export function isCopyModifierPressed(event: { altKey: boolean; ctrlKey: boolean }, platform = navigator.platform) {
  return /Mac|iPhone|iPad|iPod/.test(platform) ? Boolean(event.altKey) : Boolean(event.ctrlKey)
}

export function tagDropPosition(bounds: Pick<DOMRect, 'top' | 'bottom' | 'height'>, y: number): Exclude<TagDropPosition, 'root'> {
  if (bounds.height > 0 && y < bounds.top + bounds.height * .25) return 'before'
  if (bounds.height > 0 && y > bounds.bottom - bounds.height * .25) return 'after'
  return 'inside'
}

function targetAtPoint(x: number, y: number): TaxonomyDropTarget | null {
  const point = document.elementFromPoint?.(x, y)
  const row = point?.closest<HTMLElement>('.bp6-tree-node-content')
  if (!row) return null
  if (row.querySelector('[data-taxonomy-root-drop-target]')) return { tagId: null, position: 'root' }
  const label = row.querySelector<HTMLElement>('[data-taxonomy-tag-id]')
  const tagId = label?.dataset.taxonomyTagId
  if (!tagId) return null
  return { tagId, position: tagDropPosition(row.getBoundingClientRect(), y) }
}

export function useTaxonomyDragAndDrop(options: {
  onDrop(operation: TaxonomyDropOperation): void | Promise<void>
  canDrop?(operation: TaxonomyDropOperation): boolean
}) {
  const [dropTarget, setDropTarget] = useState<TaxonomyDropTarget | null>(null)
  const [copying, setCopying] = useState(false)
  const [draggingKind, setDraggingKind] = useState<DraggedItem['kind'] | null>(null)
  const pendingDrag = useRef<PendingDrag | null>(null)
  const draggedItem = useRef<DraggedItem | null>(null)
  const hoveredTarget = useRef<TaxonomyDropTarget | null>(null)
  const copyingRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const updateCopyFeedback = useCallback((copy: boolean) => {
    copyingRef.current = copy
    setCopying(copy)
    document.documentElement.classList.toggle('taxonomy-security-copying', copy)
  }, [])

  const reset = useCallback(() => {
    pendingDrag.current = null
    draggedItem.current = null
    hoveredTarget.current = null
    setDraggingKind(null)
    document.documentElement.classList.remove('taxonomy-security-dragging', 'taxonomy-tag-dragging')
    updateCopyFeedback(false)
    setDropTarget(null)
  }, [updateCopyFeedback])

  useEffect(() => {
    const updateCopyMode = (event: KeyboardEvent) => {
      if (draggedItem.current?.kind === 'security' || pendingDrag.current?.item.kind === 'security') {
        updateCopyFeedback(isCopyModifierPressed(event))
      }
    }
    document.addEventListener('keydown', updateCopyMode)
    document.addEventListener('keyup', updateCopyMode)
    return () => {
      document.removeEventListener('keydown', updateCopyMode)
      document.removeEventListener('keyup', updateCopyMode)
      document.documentElement.classList.remove('taxonomy-security-dragging', 'taxonomy-security-copying', 'taxonomy-tag-dragging')
    }
  }, [updateCopyFeedback])

  const operationFor = (dragged: DraggedItem, target: TaxonomyDropTarget, copy: boolean): TaxonomyDropOperation | null => {
    if (dragged.kind === 'security') {
      if (!target.tagId) return null
      return { kind: 'security', securityId: dragged.securityId, fromTagId: dragged.tagId, toTagId: target.tagId, copy }
    }
    return { kind: 'tag', tagId: dragged.tagId, targetTagId: target.tagId, position: target.position }
  }

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button && event.button !== 0) return
    const row = (event.target as Element).closest('.bp6-tree-node-content')
    const security = row?.querySelector<HTMLElement>('.taxonomy-security-label[data-security-id][data-tag-id]')
    const tag = row?.querySelector<HTMLElement>('[data-draggable-tag-id]')
    if (security?.dataset.securityId && security.dataset.tagId) {
      pendingDrag.current = {
        item: { kind: 'security', securityId: security.dataset.securityId, tagId: security.dataset.tagId },
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      }
    } else if (tag?.dataset.draggableTagId) {
      pendingDrag.current = {
        item: { kind: 'tag', tagId: tag.dataset.draggableTagId },
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      }
    } else return
    hoveredTarget.current = null
  }

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    let dragged = draggedItem.current
    const pending = pendingDrag.current
    if (!dragged && pending && pending.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < DRAG_THRESHOLD) return
      dragged = pending.item
      draggedItem.current = dragged
      pendingDrag.current = null
      setDraggingKind(dragged.kind)
      document.documentElement.classList.add(dragged.kind === 'security' ? 'taxonomy-security-dragging' : 'taxonomy-tag-dragging')
      if (dragged.kind === 'security') updateCopyFeedback(isCopyModifierPressed(event) || copyingRef.current)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    if (!dragged) return
    event.preventDefault()
    const target = targetAtPoint(event.clientX, event.clientY)
    const operation = target ? operationFor(dragged, target, copyingRef.current) : null
    const allowed = operation && (optionsRef.current.canDrop?.(operation) ?? true) ? target : null
    hoveredTarget.current = allowed
    setDropTarget(allowed)
    if (dragged.kind === 'security' && (event.altKey || event.ctrlKey)) updateCopyFeedback(isCopyModifierPressed(event))
  }

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    const dragged = draggedItem.current
    if (!dragged) {
      pendingDrag.current = null
      return
    }
    const target = targetAtPoint(event.clientX, event.clientY) ?? hoveredTarget.current
    const operation = target ? operationFor(dragged, target, isCopyModifierPressed(event) || copyingRef.current) : null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    reset()
    if (!operation || !(optionsRef.current.canDrop?.(operation) ?? true)) return
    if (operation.kind === 'security' && operation.fromTagId === operation.toTagId) return
    void optionsRef.current.onDrop(operation)
  }

  return {
    dropTarget,
    copying,
    draggingKind,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset },
  }
}
