import { browserFileOperation, imageFormat } from './editorImageStorage'

export function securityLinkOrigin(pattern:string):string|null {
  try { const url=new URL(pattern);return ['https:','http:'].includes(url.protocol)&&!/[{}]/.test(url.host)?url.origin:null } catch { return null }
}

async function fetchResource(url:string):Promise<Uint8Array> {
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');return new Uint8Array(await invoke<number[]>('fetch_favicon_resource',{url}))}
  const response=await fetch(url,{signal:AbortSignal.timeout(4000),credentials:'omit'})
  if(!response.ok)throw new Error('Icon unavailable')
  const bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes.length>1024*1024)throw new Error('Icon too large')
  return bytes
}

function faviconFormat(bytes:Uint8Array){return imageFormat(bytes)??(bytes.length>=6&&bytes[0]===0&&bytes[1]===0&&bytes[2]===1&&bytes[3]===0?{mimeType:'image/x-icon',extension:'ico'}:undefined)}

export async function storeSecurityLinkFavicon(bytes:Uint8Array):Promise<string> {
  if(bytes.byteLength>1024*1024)throw new Error('Icons must be 1 MB or smaller.')
  const format=faviconFormat(bytes)
  if(!format)throw new Error('Choose an ICO, PNG, JPEG, GIF, or WebP image.')
  const id=crypto.randomUUID(),path=`favicons/${id}.${format.extension}`
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');return invoke<string>('store_favicon',{id,bytes:Array.from(bytes)})}
  await browserFileOperation('readwrite',(store)=>store.put(new Blob([bytes],{type:format.mimeType}),path))
  return path
}

export async function uploadSecurityLinkFavicon():Promise<string|undefined> {
  if('__TAURI_INTERNALS__' in window){
    const{open}=await import('@tauri-apps/plugin-dialog')
    const path=await open({title:'Choose a link icon',multiple:false,directory:false,filters:[{name:'Icons and images',extensions:['ico','png','jpg','jpeg','gif','webp']}],fileAccessMode:'scoped'})
    if(!path)return undefined
    const{readFile}=await import('@tauri-apps/plugin-fs')
    return storeSecurityLinkFavicon(await readFile(path))
  }
  const file=await new Promise<File|undefined>((resolve)=>{
    const input=document.createElement('input');input.type='file';input.accept='.ico,.png,.jpg,.jpeg,.gif,.webp'
    input.onchange=()=>resolve(input.files?.[0]);input.oncancel=()=>resolve(undefined);input.click()
  })
  if(!file)return undefined
  if(file.size>1024*1024)throw new Error('Icons must be 1 MB or smaller.')
  return storeSecurityLinkFavicon(new Uint8Array(await file.arrayBuffer()))
}

const pending=new Map<string,Promise<string|undefined>>()
export function fetchSecurityLinkFavicon(pattern:string):Promise<string|undefined> {
  const origin=securityLinkOrigin(pattern)
  if(!origin)return Promise.resolve(undefined)
  const existing=pending.get(origin);if(existing)return existing
  const result=(async()=>{
    const candidates:string[]=[]
    try{
      const html=new TextDecoder().decode(await fetchResource(origin+'/'))
      const document=new DOMParser().parseFromString(html,'text/html')
      for(const link of document.querySelectorAll('link[rel][href]')){
        if(!link.getAttribute('rel')?.toLowerCase().split(/\s+/).some((rel)=>rel==='icon'||rel==='apple-touch-icon'))continue
        try{const url=new URL(link.getAttribute('href')!,origin+'/');if(['http:','https:'].includes(url.protocol))candidates.push(url.href)}catch{/* Try the next icon. */}
      }
    }catch{/* Some websites only expose the conventional icon path. */}
    for(const url of [...new Set(candidates)].slice(0,3).concat(origin+'/favicon.ico')){
      try{
        const bytes=await fetchResource(url),format=faviconFormat(bytes)
        if(!format)continue
        return await storeSecurityLinkFavicon(bytes)
      }catch{/* A missing favicon must never prevent saving a link. */}
    }
    return undefined
  })().finally(()=>pending.delete(origin))
  pending.set(origin,result);return result
}

export async function loadSecurityLinkFavicon(path:string):Promise<string> {
  let blob:Blob
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');const bytes=new Uint8Array(await invoke<number[]>('load_favicon',{storagePath:path}));const format=faviconFormat(bytes);if(!format)throw new Error('Invalid favicon');blob=new Blob([bytes],{type:format.mimeType})}
  else{blob=await browserFileOperation('readonly',(store)=>store.get(path));if(!(blob instanceof Blob))throw new Error('Missing favicon')}
  return URL.createObjectURL(blob)
}
