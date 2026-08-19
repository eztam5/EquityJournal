export const WATCHLIST_DRAG_HOVER_EVENT='equity-journal:watchlist-drag-hover'

export function watchlistDropTargetAt(x:number,y:number) {
  const element=document.elementFromPoint?.(x,y)
  return element?.closest<HTMLElement>('[data-watchlist-id]')?.dataset.watchlistId??null
}

export function announceWatchlistDragHover(watchlistId:string|null) {
  window.dispatchEvent(new CustomEvent(WATCHLIST_DRAG_HOVER_EVENT,{detail:watchlistId}))
}
