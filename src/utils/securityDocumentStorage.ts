import type { SecurityDocumentInput } from '../data/repository'

export type PdfImportSource={kind:'path';path:string}|{kind:'file';file:File}

const ATTACHMENTS_DIRECTORY='securities'
const BROWSER_DB='equity-journal-development-attachments'
const BROWSER_STORE='files'

function fileNameFromPath(path:string){return path.split(/[\\/]/).pop()??'document.pdf'}
function titleFromFilename(filename:string){return filename.replace(/\.pdf$/i,'').replaceAll('_',' ').trim()||'PDF document'}
function isPdfFilename(filename:string){return filename.toLocaleLowerCase().endsWith('.pdf')}
function isPdfBytes(bytes:Uint8Array){return bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-'}

async function sha256(bytes:Uint8Array){
  const buffer=new Uint8Array(bytes).buffer
  const digest=await crypto.subtle.digest('SHA-256',buffer)
  return [...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,'0')).join('')
}

function openBrowserDb(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(BROWSER_DB,1)
    request.onupgradeneeded=()=>request.result.createObjectStore(BROWSER_STORE)
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}

async function browserFileOperation<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>){
  const db=await openBrowserDb()
  return new Promise<T>((resolve,reject)=>{const transaction=db.transaction(BROWSER_STORE,mode),request=operation(transaction.objectStore(BROWSER_STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);transaction.oncomplete=()=>db.close()})
}

async function readSource(source:PdfImportSource){
  if(source.kind==='file')return{filename:source.file.name,bytes:new Uint8Array(await source.file.arrayBuffer())}
  const{readFile}=await import('@tauri-apps/plugin-fs')
  return{filename:fileNameFromPath(source.path),bytes:await readFile(source.path)}
}

export async function pickPdfSources():Promise<PdfImportSource[]> {
  if('__TAURI_INTERNALS__' in window){
    const{open}=await import('@tauri-apps/plugin-dialog')
    const paths=await open({title:'Attach PDF documents',multiple:true,directory:false,filters:[{name:'PDF documents',extensions:['pdf']}],fileAccessMode:'scoped'})
    return(paths??[]).map((path)=>({kind:'path' as const,path}))
  }
  return new Promise((resolve)=>{const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';input.multiple=true;input.onchange=()=>resolve([...input.files??[]].map((file)=>({kind:'file' as const,file})));input.oncancel=()=>resolve([]);input.click()})
}

export async function storeSecurityDocument(securityId:string,source:PdfImportSource):Promise<SecurityDocumentInput> {
  const{filename,bytes}=await readSource(source)
  if(!isPdfFilename(filename)||!isPdfBytes(bytes))throw new Error(`“${filename}” is not a valid PDF document.`)
  const id=crypto.randomUUID(),storagePath=`${ATTACHMENTS_DIRECTORY}/${securityId}/${id}.pdf`,digest=await sha256(bytes)
  if('__TAURI_INTERNALS__' in window){
    if(source.kind!=='path')throw new Error('The selected PDF does not have a native file path.')
    const{invoke}=await import('@tauri-apps/api/core')
    const managedPath=await invoke<string>('import_security_document',{securityId,documentId:id,sourcePath:source.path})
    return{id,securityId,title:titleFromFilename(filename),originalFilename:filename,storagePath:managedPath,source:'',documentDate:'',mimeType:'application/pdf',fileSize:bytes.byteLength,sha256:digest}
  }else{
    await browserFileOperation('readwrite',(store)=>store.put(new Blob([bytes],{type:'application/pdf'}),storagePath))
  }
  return{id,securityId,title:titleFromFilename(filename),originalFilename:filename,storagePath,source:'',documentDate:'',mimeType:'application/pdf',fileSize:bytes.byteLength,sha256:digest}
}

export async function openSecurityDocument(storagePath:string) {
  if('__TAURI_INTERNALS__' in window){
    const{invoke}=await import('@tauri-apps/api/core');await invoke('open_security_document',{storagePath});return
  }
  const blob=await browserFileOperation('readonly',(store)=>store.get(storagePath))
  if(!(blob instanceof Blob))throw new Error('This development attachment is no longer available. Import it again.')
  const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener,noreferrer');window.setTimeout(()=>URL.revokeObjectURL(url),60_000)
}

export async function revealSecurityDocument(storagePath:string) {
  if(!('__TAURI_INTERNALS__' in window))return false
  const{invoke}=await import('@tauri-apps/api/core');await invoke('reveal_security_document',{storagePath});return true
}

export async function removeSecurityDocument(storagePath:string) {
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');await invoke('remove_security_document',{storagePath});return}
  await browserFileOperation('readwrite',(store)=>store.delete(storagePath))
}

export async function removeSecurityDocumentDirectory(securityId:string) {
  const path=`${ATTACHMENTS_DIRECTORY}/${securityId}`
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');await invoke('remove_security_document_directory',{securityId});return}
  const keys=await browserFileOperation('readonly',(store)=>store.getAllKeys())
  const legacyPath=`attachments/${path}`
  await Promise.all(keys.filter((key)=>String(key).startsWith(`${path}/`)||String(key).startsWith(`${legacyPath}/`)).map((key)=>browserFileOperation('readwrite',(store)=>store.delete(key))))
}

export function formatFileSize(bytes:number){if(bytes<1024)return`${bytes} B`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(bytes<10*1024?1:0)} KB`;return`${(bytes/(1024*1024)).toFixed(1)} MB`}
