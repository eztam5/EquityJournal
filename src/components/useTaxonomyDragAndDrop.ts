import { useCallback, useEffect, useRef, useState, type PointerEventHandler } from 'react'

export interface TaxonomyDropOperation {
  securityId: string
  fromTagId: string
  toTagId: string
  copy: boolean
}

interface DraggedSecurity {
  securityId: string
  tagId: string
}

export function isCopyModifierPressed(event: { altKey: boolean; ctrlKey: boolean }, platform = navigator.platform) {
  return /Mac|iPhone|iPad|iPod/.test(platform) ? Boolean(event.altKey) : Boolean(event.ctrlKey)
}

function tagAtPoint(x: number, y: number) {
  const point = document.elementFromPoint?.(x, y)
  const label = point?.closest<HTMLElement>('[data-taxonomy-tag-id]')
    ?? point?.closest('.bp6-tree-node-content')?.querySelector<HTMLElement>('[data-taxonomy-tag-id]')
  return label?.dataset.taxonomyTagId ?? ''
}

export function useTaxonomyDragAndDrop(onDrop: (operation: TaxonomyDropOperation) => void | Promise<void>) {
  const [dropTargetId, setDropTargetId] = useState('')
  const [copying, setCopying] = useState(false)
  const draggedSecurity = useRef<DraggedSecurity | null>(null)
  const hoveredTag = useRef('')
  const copyingRef = useRef(false)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  const updateCopyFeedback = useCallback((copy: boolean) => {
    copyingRef.current = copy
    setCopying(copy)
    document.documentElement.classList.toggle('taxonomy-security-copying', copy)
  }, [])

  const reset = useCallback(() => {
    draggedSecurity.current = null
    hoveredTag.current = ''
    document.documentElement.classList.remove('taxonomy-security-dragging')
    updateCopyFeedback(false)
    setDropTargetId('')
  }, [updateCopyFeedback])

  useEffect(() => {
    const updateCopyMode = (event: KeyboardEvent) => {
      if (draggedSecurity.current) updateCopyFeedback(isCopyModifierPressed(event))
    }
    document.addEventListener('keydown', updateCopyMode)
    document.addEventListener('keyup', updateCopyMode)
    return () => {
      document.removeEventListener('keydown', updateCopyMode)
      document.removeEventListener('keyup', updateCopyMode)
      document.documentElement.classList.remove('taxonomy-security-dragging', 'taxonomy-security-copying')
    }
  }, [updateCopyFeedback])

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button && event.button !== 0) return
    const row = (event.target as Element).closest('.bp6-tree-node-content')
    const label = row?.querySelector<HTMLElement>('.taxonomy-security-label[data-security-id][data-tag-id]')
    const securityId = label?.dataset.securityId
    const tagId = label?.dataset.tagId
    if (!securityId || !tagId) return
    draggedSecurity.current = { securityId, tagId }
    hoveredTag.current = ''
    updateCopyFeedback(isCopyModifierPressed(event))
    document.documentElement.classList.add('taxonomy-security-dragging')
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (!draggedSecurity.current) return
    event.preventDefault()
    const tagId = tagAtPoint(event.clientX, event.clientY)
    hoveredTag.current = tagId
    setDropTargetId(tagId)
    if (event.altKey || event.ctrlKey) updateCopyFeedback(isCopyModifierPressed(event))
  }

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    const dragged = draggedSecurity.current
    if (!dragged) return
    const toTagId = tagAtPoint(event.clientX, event.clientY) || hoveredTag.current
    const copy = isCopyModifierPressed(event) || copyingRef.current
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    reset()
    if (!toTagId || dragged.tagId === toTagId) return
    void onDropRef.current({ securityId: dragged.securityId, fromTagId: dragged.tagId, toTagId, copy })
  }

  return {
    dropTargetId,
    copying,
    pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset },
  }
}
