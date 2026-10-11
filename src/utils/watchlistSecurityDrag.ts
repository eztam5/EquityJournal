export const WATCHLIST_DRAG_HOVER_EVENT='equity-journal:watchlist-drag-hover'

export function isAdditiveSelectionModifier(event:{metaKey:boolean;ctrlKey:boolean},platform=navigator.platform) {
  return /Mac|iPhone|iPad|iPod/.test(platform)?event.metaKey:event.ctrlKey
}

export function watchlistDropTargetAt(x:number,y:number) {
  const element=document.elementFromPoint?.(x,y)
  return element?.closest<HTMLElement>('[data-watchlist-id]')?.dataset.watchlistId??null
}

export function announceWatchlistDragHover(watchlistId:string|null) {
  window.dispatchEvent(new CustomEvent(WATCHLIST_DRAG_HOVER_EVENT,{detail:watchlistId}))
}

export const CLASSIFICATION_DRAG_HOVER_EVENT='equity-journal:classification-drag-hover'

export function classificationDropTargetAt(x:number,y:number) {
  const element=document.elementFromPoint?.(x,y)?.closest<HTMLElement>('[data-classification-tag-id]')
  const tagId=element?.dataset.classificationTagId,taxonomyId=element?.dataset.classificationTaxonomyId
  return tagId&&taxonomyId?{tagId,taxonomyId}:null
}

export function announceClassificationDragHover(tagId:string|null) {
  window.dispatchEvent(new CustomEvent(CLASSIFICATION_DRAG_HOVER_EVENT,{detail:tagId}))
}
