import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useApp } from '../app/AppContext'
import type { Tag, Taxonomy } from '../domain/types'
import { TagAssignmentDialog } from './TagAssignmentDialog'

const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })))

export function SecurityDetailView({id}:{id:string}){
  const app=useApp();const security=app.securities.find((x)=>x.id===id);const[tags,setTags]=useState<Tag[]>([]);const[assigned,setAssigned]=useState<string[]>([]);const[assigning,setAssigning]=useState(false);const[content,setContent]=useState('');const[status,setStatus]=useState('');const contentRef=useRef('');const loadedId=useRef('')
  const loadAssignments=useCallback(async()=>{const groups=await Promise.all(app.taxonomies.map((x)=>app.repository.listTags(x.id)));setTags(groups.flat());setAssigned(await app.repository.assignedTagIds(id))},[app.repository,app.taxonomies,id])
  useEffect(()=>{loadAssignments()},[loadAssignments]);useEffect(()=>{app.repository.loadNote(id).then((note)=>{loadedId.current=id;contentRef.current=note.contentHtml;setContent(note.contentHtml);setStatus(note.updatedAt?'Saved':'')})},[app.repository,id])
  useEffect(()=>{if(loadedId.current!==id||content===contentRef.current)return;setStatus('Unsaved changes');const timer=setTimeout(async()=>{try{await app.repository.saveNote(id,content);contentRef.current=content;setStatus('Saved')}catch(r){setStatus(r instanceof Error?r.message:String(r))}},1200);return()=>clearTimeout(timer)},[app.repository,content,id])
  const grouped=useMemo(()=>app.taxonomies.map((taxonomy)=>({taxonomy,tags:tags.filter((tag)=>tag.taxonomyId===taxonomy.id&&assigned.includes(tag.id))})).filter((x)=>x.tags.length),[app.taxonomies,tags,assigned])
  if(!security)return <main className="content page"><div className="empty-state">Security not found.</div></main>
  const remove=async(tagId:string)=>{await app.repository.setAssignedTags(id,assigned.filter((x)=>x!==tagId));await loadAssignments()}
  return <main className="content page detail-page"><header className="security-heading"><h1>{security.symbol}</h1><p>{security.name}</p></header><section className="info-card"><div><span>Symbol</span><strong>{security.symbol}</strong></div><div><span>Currency</span><strong>{security.currency}</strong></div><div><span>Company name</span><strong>{security.name}</strong></div></section>
    <section className="classification-card"><header><h2>Classification</h2><button onClick={()=>setAssigning(true)}><Plus size={15}/> Add tags</button></header>{grouped.length===0?<p className="muted">No tags assigned yet</p>:grouped.map(({taxonomy,tags})=><div className="assigned-group" key={taxonomy.id}><h3>{taxonomy.name}</h3><div>{tags.map((tag)=><button className="tag-chip" style={{borderColor:tag.color}} key={tag.id} onClick={()=>remove(tag.id)}>{tag.name}<X size={13}/></button>)}</div></div>)}</section>
    <section className="notes-card"><header><h2>Research Notes</h2><span>{status}</span><button onClick={async()=>{await app.repository.saveNote(id,content);contentRef.current=content;setStatus('Saved')}}>Save</button></header><Suspense fallback={<div className="empty-state">Loading editor…</div>}><RichTextEditor key={id} content={content} onChange={setContent}/></Suspense></section>{assigning&&<TagAssignmentDialog securityId={id} onClose={()=>setAssigning(false)} onSaved={loadAssignments}/>} 
  </main>
}
