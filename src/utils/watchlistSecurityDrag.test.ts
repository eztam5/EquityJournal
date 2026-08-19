import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchlistDropTargetAt } from './watchlistSecurityDrag'

describe('watchlist security drag',()=>{
  afterEach(()=>{vi.restoreAllMocks();Reflect.deleteProperty(document,'elementFromPoint')})

  it('resolves a watchlist from a nested element at the pointer',()=>{
    const watchlist=document.createElement('button')
    watchlist.dataset.watchlistId='watchlist-1'
    const icon=document.createElement('span')
    watchlist.append(icon)
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>icon)})

    expect(watchlistDropTargetAt(20,30)).toBe('watchlist-1')
  })
})
