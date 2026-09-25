import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSecurityLinkFavicon, securityLinkOrigin, storeSecurityLinkFavicon } from './securityLinkFavicons'
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}))
vi.mock('@tauri-apps/api/core',()=>({invoke}))
afterEach(()=>{vi.clearAllMocks();delete (window as unknown as Record<string,unknown>).__TAURI_INTERNALS__})
const bytes=(text:string)=>Array.from(new TextEncoder().encode(text))

describe('security link favicons',()=>{
  it('stores manually supplied icons in the managed favicon folder',async()=>{
    Object.assign(window,{__TAURI_INTERNALS__:{}})
    invoke.mockResolvedValue('favicons/manual.png')
    const png=new Uint8Array([137,80,78,71,13,10,26,10])
    expect(await storeSecurityLinkFavicon(png)).toBe('favicons/manual.png')
    expect(invoke).toHaveBeenCalledWith('store_favicon',{id:expect.any(String),bytes:Array.from(png)})
  })
  it('rejects unsupported and oversized uploads before writing files',async()=>{
    await expect(storeSecurityLinkFavicon(new Uint8Array([1,2,3]))).rejects.toThrow('Choose an ICO')
    await expect(storeSecurityLinkFavicon(new Uint8Array(1024*1024+1))).rejects.toThrow('1 MB')
    expect(invoke).not.toHaveBeenCalled()
  })
  it('extracts the origin without substituting ticker placeholders',()=>{
    expect(securityLinkOrigin('https://finance.example.com/quote/{SYMBOL}?id={ALTERNATIVE_ID}')).toBe('https://finance.example.com')
    expect(securityLinkOrigin('javascript:alert(1)')).toBeNull()
    expect(securityLinkOrigin('https://{SYMBOL}.example.com')).toBeNull()
  })
  it('discovers and stores a declared icon through the desktop backend',async()=>{
    Object.assign(window,{__TAURI_INTERNALS__:{}})
    invoke.mockImplementation(async(command,args)=>{
      if(command==='store_favicon')return 'favicons/saved.ico'
      if(args.url==='https://example.com/')return bytes('<link rel="shortcut icon" href="/assets/site.ico">')
      if(args.url==='https://example.com/assets/site.ico')return [0,0,1,0,1,0,1]
      throw new Error('unexpected URL')
    })
    expect(await fetchSecurityLinkFavicon('https://example.com/{SYMBOL}')).toBe('favicons/saved.ico')
    expect(invoke).toHaveBeenCalledWith('store_favicon',{id:expect.any(String),bytes:[0,0,1,0,1,0,1]})
  })
  it('falls back to favicon.ico if the home page fails',async()=>{
    Object.assign(window,{__TAURI_INTERNALS__:{}})
    invoke.mockImplementation(async(command,args)=>{
      if(command==='store_favicon')return 'favicons/fallback.ico'
      if(args.url.endsWith('/favicon.ico'))return [0,0,1,0,1,0,1]
      throw new Error('offline')
    })
    expect(await fetchSecurityLinkFavicon('https://example.com/{SYMBOL}')).toBe('favicons/fallback.ico')
  })
  it('returns no icon for failed requests or non-image responses',async()=>{
    Object.assign(window,{__TAURI_INTERNALS__:{}})
    invoke.mockRejectedValue(new Error('offline'))
    expect(await fetchSecurityLinkFavicon('https://example.com/{SYMBOL}')).toBeUndefined()
    invoke.mockResolvedValue(bytes('<html>Not an icon</html>'))
    expect(await fetchSecurityLinkFavicon('https://example.com/{SYMBOL}')).toBeUndefined()
    expect(invoke.mock.calls.some(([command])=>command==='store_favicon')).toBe(false)
  })
})
