import type { EditorImage, EditorImageContext, EditorImageOwnerType } from '../domain/types'
import type { EquityRepository } from '../data/repository'

export type EditorImageSource={kind:'path';path:string}|{kind:'file';file:File}

const BROWSER_DB='equity-journal-development-attachments'
const BROWSER_STORE='files'
const MAX_IMAGE_SIZE=10*1024*1024
export const EDITOR_IMAGE_ORPHAN_GRACE_MS=7*24*60*60*1000

function openBrowserDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(BROWSER_DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(BROWSER_STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
function browserFileOperation<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>){const dbPromise=openBrowserDb();return dbPromise.then((db)=>new Promise<T>((resolve,reject)=>{const transaction=db.transaction(BROWSER_STORE,mode),request=operation(transaction.objectStore(BROWSER_STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);transaction.oncomplete=()=>db.close()}))}
function fileNameFromPath(path:string){return path.split(/[\\/]/).pop()||'image'}
async function readSource(source:EditorImageSource){if(source.kind==='file')return{filename:source.file.name||'pasted-image',bytes:new Uint8Array(await source.file.arrayBuffer())};const{readFile}=await import('@tauri-apps/plugin-fs');return{filename:fileNameFromPath(source.path),bytes:await readFile(source.path)}}
function imageFormat(bytes:Uint8Array):{mimeType:string;extension:string}|undefined{
  if(bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value))return{mimeType:'image/png',extension:'png'}
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{mimeType:'image/jpeg',extension:'jpg'}
  const header=String.fromCharCode(...bytes.slice(0,12))
  if(header.startsWith('GIF87a')||header.startsWith('GIF89a'))return{mimeType:'image/gif',extension:'gif'}
  if(header.startsWith('RIFF')&&header.slice(8,12)==='WEBP')return{mimeType:'image/webp',extension:'webp'}
}
async function sha256(bytes:Uint8Array){const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer);return[...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,'0')).join('')}
function ownerDirectory(ownerType:EditorImageOwnerType){return ownerType==='security'?'securities':'topics'}

export async function pickEditorImageSources():Promise<EditorImageSource[]>{
  if('__TAURI_INTERNALS__' in window){const{open}=await import('@tauri-apps/plugin-dialog');const paths=await open({title:'Insert images',multiple:true,directory:false,filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif']}],fileAccessMode:'scoped'});return(paths??[]).map((path)=>({kind:'path' as const,path}))}
  return new Promise((resolve)=>{const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';input.multiple=true;input.onchange=()=>resolve([...input.files??[]].map((file)=>({kind:'file' as const,file})));input.oncancel=()=>resolve([]);input.click()})
}

export async function storeEditorImage(repository:EquityRepository,context:EditorImageContext,source:EditorImageSource):Promise<EditorImage>{
  const{filename,bytes}=await readSource(source),format=imageFormat(bytes)
  if(!format)throw new Error(`“${filename}” is not a supported PNG, JPEG, WebP, or GIF image.`)
  if(bytes.byteLength>MAX_IMAGE_SIZE)throw new Error(`“${filename}” is larger than 10 MB.`)
  const id=crypto.randomUUID(),fallbackPath=`${ownerDirectory(context.ownerType)}/${context.ownerId}/images/${id}.${format.extension}`
  let storagePath=fallbackPath
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');storagePath=await invoke<string>('store_editor_image',{ownerType:context.ownerType,ownerId:context.ownerId,imageId:id,bytes:Array.from(bytes)})}
  else await browserFileOperation('readwrite',(store)=>store.put(new Blob([bytes],{type:format.mimeType}),storagePath))
  try{return await repository.addEditorImage({id,ownerType:context.ownerType,ownerId:context.ownerId,originalFilename:filename,storagePath,mimeType:format.mimeType,fileSize:bytes.byteLength,sha256:await sha256(bytes)})}
  catch(reason){await removeEditorImageFile(storagePath).catch(()=>{});throw reason}
}

export async function createEditorImageObjectUrl(repository:EquityRepository,context:EditorImageContext,imageId:string){
  const image=await repository.getEditorImage(imageId)
  if(!image||image.ownerType!==context.ownerType||image.ownerId!==context.ownerId)throw new Error('This managed image is no longer available.')
  let blob:Blob
  if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');const bytes=await invoke<number[]>('load_editor_image',{storagePath:image.storagePath});blob=new Blob([new Uint8Array(bytes)],{type:image.mimeType})}
  else{const stored=await browserFileOperation('readonly',(store)=>store.get(image.storagePath));if(!(stored instanceof Blob))throw new Error('This managed image is no longer available.');blob=stored}
  const url=URL.createObjectURL(blob);return{url,release:()=>URL.revokeObjectURL(url)}
}

export async function removeEditorImageFile(storagePath:string){if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');await invoke('remove_editor_image',{storagePath});return}await browserFileOperation('readwrite',(store)=>store.delete(storagePath))}

export async function cleanupOrphanedEditorImages(repository:EquityRepository){const before=new Date(Date.now()-EDITOR_IMAGE_ORPHAN_GRACE_MS).toISOString(),images=await repository.listOrphanedEditorImages(before);for(const image of images){try{await removeEditorImageFile(image.storagePath);await repository.deleteEditorImage(image.id)}catch{/* Keep metadata so cleanup can retry later. */}}}

export async function removeTopicAttachmentDirectory(topicId:string){if('__TAURI_INTERNALS__' in window){const{invoke}=await import('@tauri-apps/api/core');await invoke('remove_topic_attachment_directory',{topicId});return}const prefix=`topics/${topicId}/`,keys=await browserFileOperation('readonly',(store)=>store.getAllKeys());await Promise.all(keys.filter((key)=>String(key).startsWith(prefix)).map((key)=>browserFileOperation('readwrite',(store)=>store.delete(key))))}
