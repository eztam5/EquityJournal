import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonGroup, Card, Tag as BlueprintTag } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Tag, Taxonomy } from '../domain/types'
import { TagAssignmentDialog } from './TagAssignmentDialog'
import { ResearchJournal } from './ResearchJournal'
import { resolveSecurityLink } from '../data/repository'
import { openExternalUrl } from '../utils/externalLinks'
import { SecurityForm } from './Forms'
import { PageHeader } from './PageHeader'

const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })))

export function tagAssignmentPath(tag:Tag,tags:Tag[]) {
  const byId=new Map(tags.filter((candidate)=>candidate.taxonomyId===tag.taxonomyId).map((candidate)=>[candidate.id,candidate]))
  const names:string[]=[];const visited=new Set<string>();let current:Tag|undefined=tag
  while(current&&!visited.has(current.id)){visited.add(current.id);names.unshift(current.name);current=current.parentId?byId.get(current.parentId):undefined}
  return names.join(' ▸ ')
}

export function SecurityDetailView({id}:{id:string}){
  const app=useApp();const security=app.securities.find((x)=>x.id===id);const[tags,setTags]=useState<Tag[]>([]);const[assigned,setAssigned]=useState<string[]>([]);const[assigning,setAssigning]=useState(false);const[editing,setEditing]=useState(false);const[content,setContent]=useState('');const[status,setStatus]=useState('');const[loadedNoteId,setLoadedNoteId]=useState('');const[noteLoadError,setNoteLoadError]=useState('');const[researchTab,setResearchTab]=useState<'thesis'|'journal'>('thesis');const contentRef=useRef('');const loadedIdRef=useRef('')
  const loadAssignments=useCallback(async()=>{const groups=await Promise.all(app.taxonomies.map((x)=>app.repository.listTags(x.id)));setTags(groups.flat());setAssigned(await app.repository.assignedTagIds(id))},[app.repository,app.taxonomies,id])
  useEffect(()=>{loadAssignments()},[loadAssignments]);useEffect(()=>{let active=true;loadedIdRef.current='';setLoadedNoteId('');setNoteLoadError('');setContent('');contentRef.current='';setStatus('');app.repository.loadNote(id).then((note)=>{if(!active)return;loadedIdRef.current=id;contentRef.current=note.contentHtml;setContent(note.contentHtml);setStatus(note.updatedAt?'Saved':'');setLoadedNoteId(id)}).catch((reason)=>{if(!active)return;setNoteLoadError(reason instanceof Error?reason.message:String(reason))});return()=>{active=false}},[app.repository,id])
  useEffect(()=>{if(loadedNoteId!==id||content===contentRef.current)return;setStatus('Unsaved changes');const noteId=id,noteContent=content;const timer=setTimeout(async()=>{try{await app.repository.saveNote(noteId,noteContent);if(loadedIdRef.current!==noteId)return;contentRef.current=noteContent;setStatus('Saved')}catch(r){if(loadedIdRef.current===noteId)setStatus(r instanceof Error?r.message:String(r))}},1200);return()=>clearTimeout(timer)},[app.repository,content,id,loadedNoteId])
  const grouped=useMemo(()=>app.taxonomies.map((taxonomy)=>({taxonomy,tags:tags.filter((tag)=>tag.taxonomyId===taxonomy.id&&assigned.includes(tag.id))})).filter((x)=>x.tags.length),[app.taxonomies,tags,assigned])
  if(!security)return <main className="content page"><div className="empty-state">Security not found.</div></main>
  const remove=async(tagId:string)=>{await app.repository.setAssignedTags(id,assigned.filter((x)=>x!==tagId));await loadAssignments()}
  const links=app.securityLinkTemplates.flatMap((template)=>{const url=resolveSecurityLink(template,security);return url?[{...template,url}]:[]})
  const saveNote=async()=>{const noteId=id,noteContent=content;try{await app.repository.saveNote(noteId,noteContent);if(loadedIdRef.current!==noteId)return false;contentRef.current=noteContent;setStatus('Saved');return true}catch(reason){if(loadedIdRef.current===noteId)setStatus(reason instanceof Error?reason.message:String(reason));return false}}
  return <main className="content page detail-page"><PageHeader title={security.symbol} description={security.name} actions={<Button className="page-toolbar-button" icon="edit" text="Edit security" onClick={()=>setEditing(true)}/>}/><Card className="content-panel info-card" elevation={0}><div><span>Symbol</span><strong>{security.symbol}</strong></div><div><span>Alternative ID</span><strong>{security.alternativeId||'—'}</strong></div><div><span>Currency</span><strong>{security.currency}</strong></div><div><span>Company name</span><strong>{security.name}</strong></div><div className="security-links"><span>Links</span>{links.length?<div>{links.map((link)=><Button key={link.id} variant="minimal" size="small" icon="share" text={link.linkText} onClick={()=>openExternalUrl(link.url)}/>)}</div>:<strong>—</strong>}</div></Card>
    <Card className="content-panel classification-card" elevation={0}><header><h2>Classification</h2><Button icon="add" text="Add tags" size="small" onClick={()=>setAssigning(true)}/></header>{grouped.length===0?<p className="muted">No tags assigned yet</p>:grouped.map(({taxonomy,tags:assignedTags})=><div className="assigned-group" key={taxonomy.id}><h3>{taxonomy.name}</h3><div>{assignedTags.map((tag)=><BlueprintTag interactive round minimal onRemove={()=>remove(tag.id)} style={{borderColor:tag.color}} key={tag.id}>{tagAssignmentPath(tag,tags)}</BlueprintTag>)}</div></div>)}</Card>
    <Card className="content-panel notes-card" elevation={0}><header><h2>Research Notes</h2><ButtonGroup className="research-tabs" role="tablist"><Button role="tab" aria-selected={researchTab==='thesis'} active={researchTab==='thesis'} text="Current Thesis" onClick={()=>setResearchTab('thesis')}/><Button role="tab" aria-selected={researchTab==='journal'} active={researchTab==='journal'} text="Journal" onClick={()=>setResearchTab('journal')}/></ButtonGroup>{researchTab==='thesis'&&<><span>{status}</span><Button icon="floppy-disk" text="Save" size="small" disabled={loadedNoteId!==id} onClick={saveNote}/></>}</header>{researchTab==='thesis'?(noteLoadError?<div className="empty-state">Could not load current thesis: {noteLoadError}</div>:loadedNoteId!==id?<div className="empty-state">Loading editor…</div>:<Suspense fallback={<div className="empty-state">Loading editor…</div>}><RichTextEditor key={id} content={content} onChange={setContent} beforeNavigate={saveNote}/></Suspense>):<ResearchJournal key={id} securityId={id}/>}</Card>
    {assigning&&<TagAssignmentDialog securityId={id} onClose={()=>setAssigning(false)} onSaved={loadAssignments}/>}
    {editing&&<SecurityForm security={security} onClose={()=>setEditing(false)}/>}
  </main>
}
