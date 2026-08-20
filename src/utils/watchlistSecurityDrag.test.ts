import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAdditiveSelectionModifier, watchlistDropTargetAt } from './watchlistSecurityDrag'

describe('watchlist security drag',()=>{
  afterEach(()=>{vi.restoreAllMocks();Reflect.deleteProperty(document,'elementFromPoint')})

  it('uses Command on Apple platforms and Control elsewhere for additive selection',()=>{
    expect(isAdditiveSelectionModifier({metaKey:true,ctrlKey:false},'MacIntel')).toBe(true)
    expect(isAdditiveSelectionModifier({metaKey:false,ctrlKey:true},'MacIntel')).toBe(false)
    expect(isAdditiveSelectionModifier({metaKey:false,ctrlKey:true},'Win32')).toBe(true)
    expect(isAdditiveSelectionModifier({metaKey:true,ctrlKey:false},'Linux x86_64')).toBe(false)
  })

  it('resolves a watchlist from a nested element at the pointer',()=>{
    const watchlist=document.createElement('button')
    watchlist.dataset.watchlistId='watchlist-1'
    const icon=document.createElement('span')
    watchlist.append(icon)
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:vi.fn(()=>icon)})

    expect(watchlistDropTargetAt(20,30)).toBe('watchlist-1')
  })
})
