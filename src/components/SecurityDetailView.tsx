import { InvestmentChecklist } from './InvestmentChecklist'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Button, ButtonGroup, Card } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { SecurityJournalEntry } from '../domain/types'
import { ResearchJournal } from './ResearchJournal'
import { SecurityForm } from './Forms'
import { SecurityDocuments } from './SecurityDocuments'
import { SecurityPriceChart } from './SecurityPriceChart'
import { SecurityDetailLayout } from './SecurityDetailLayout'
import { PageHeader, PageToolbarIconBar, PageToolbarIconButton } from './PageHeader'

const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })))

export function SecurityDetailView({id}:{id:string}){
  const app=useApp();const security=app.securities.find((x)=>x.id===id);const[editing,setEditing]=useState(false);const[content,setContent]=useState('');const[status,setStatus]=useState('');const[loadedNoteId,setLoadedNoteId]=useState('');const[noteLoadError,setNoteLoadError]=useState('');const[researchTab,setResearchTab]=useState<'thesis'|'journal'|'documents'|'checklist'>('thesis');const[selectedJournalEntryId,setSelectedJournalEntryId]=useState<string>();const[journalRevision,setJournalRevision]=useState(0);const[documentCount,setDocumentCount]=useState(0);const contentRef=useRef('');const loadedIdRef=useRef('')
  useEffect(()=>{let active=true;loadedIdRef.current='';setLoadedNoteId('');setNoteLoadError('');setContent('');contentRef.current='';setStatus('');app.repository.loadNote(id).then((note)=>{if(!active)return;loadedIdRef.current=id;contentRef.current=note.contentHtml;setContent(note.contentHtml);setStatus(note.updatedAt?'Saved':'');setLoadedNoteId(id)}).catch((reason)=>{if(!active)return;setNoteLoadError(reason instanceof Error?reason.message:String(reason))});return()=>{active=false}},[app.repository,id])
  useEffect(()=>{let active=true;setDocumentCount(0);app.repository.listSecurityDocuments(id).then((documents)=>{if(active)setDocumentCount(documents.length)}).catch(()=>{});return()=>{active=false}},[app.repository,id])
  useEffect(()=>{if(loadedNoteId!==id||content===contentRef.current)return;setStatus('Unsaved changes');const noteId=id,noteContent=content;const timer=setTimeout(async()=>{setStatus('Saving…');try{await app.repository.saveNote(noteId,noteContent);if(loadedIdRef.current!==noteId)return;contentRef.current=noteContent;setStatus('Saved')}catch(r){if(loadedIdRef.current===noteId)setStatus(r instanceof Error?r.message:String(r))}},1200);return()=>clearTimeout(timer)},[app.repository,content,id,loadedNoteId])
  if(!security)return <main className="content page"><div className="empty-state">Security not found.</div></main>
  const saveNote=async()=>{const noteId=id,noteContent=content;setStatus('Saving…');try{await app.repository.saveNote(noteId,noteContent);if(loadedIdRef.current!==noteId)return false;contentRef.current=noteContent;setStatus('Saved');return true}catch(reason){if(loadedIdRef.current===noteId)setStatus(reason instanceof Error?reason.message:String(reason));return false}}
  const saveFailed=Boolean(status&&!['Saved','Saving…','Unsaved changes'].includes(status)),saveText=status==='Saved'?'Saved':status==='Saving…'?'Saving…':saveFailed?'Retry':'Save',saveIcon=status==='Saved'?'tick':saveFailed?'warning-sign':'floppy-disk'
  const openJournalEntry=(entry:SecurityJournalEntry)=>{setSelectedJournalEntryId(entry.id);setResearchTab('journal');requestAnimationFrame(()=>document.querySelector('.notes-card')?.scrollIntoView?.({behavior:'smooth',block:'start'}))}
  return <main className="content page detail-page">
    <PageHeader title={security.symbol} description={security.name} actions={<PageToolbarIconBar><PageToolbarIconButton icon="edit" label="Edit security" onClick={()=>setEditing(true)}/></PageToolbarIconBar>}/>
    <SecurityDetailLayout security={security}>
    <SecurityPriceChart key={security.id} security={security} journalRevision={journalRevision} onJournalEntryClick={openJournalEntry}/>
    <Card className="content-panel notes-card" elevation={0}><header><h2>Research</h2>{researchTab==='thesis'&&<div className="research-save-controls"><Button icon={saveIcon} text={saveText} title={saveFailed?status:saveText} loading={status==='Saving…'} size="small" disabled={loadedNoteId!==id||status==='Saving…'} onClick={saveNote}/></div>}<ButtonGroup className="research-tabs" role="tablist"><Button role="tab" aria-selected={researchTab==='thesis'} active={researchTab==='thesis'} text="Current Thesis" onClick={()=>setResearchTab('thesis')}/><Button role="tab" aria-selected={researchTab==='journal'} active={researchTab==='journal'} text="Journal" onClick={()=>setResearchTab('journal')}/><Button role="tab" aria-selected={researchTab==='documents'} active={researchTab==='documents'} text={`Documents (${documentCount})`} onClick={()=>setResearchTab('documents')}/><Button role="tab" aria-selected={researchTab==='checklist'} active={researchTab==='checklist'} text="Checklist" onClick={()=>setResearchTab('checklist')}/></ButtonGroup></header>{researchTab==='thesis'?(noteLoadError?<div className="empty-state">Could not load current thesis: {noteLoadError}</div>:loadedNoteId!==id?<div className="empty-state">Loading editor…</div>:<Suspense fallback={<div className="empty-state">Loading editor…</div>}><RichTextEditor key={id} content={content} onChange={setContent} beforeNavigate={saveNote} imageContext={{ownerType:'security',ownerId:id,contentType:'security-note',contentId:id}}/></Suspense>):researchTab==='journal'?<ResearchJournal key={id} securityId={id} selectedEntryId={selectedJournalEntryId} onSaved={()=>setJournalRevision((value)=>value+1)}/>:researchTab==='checklist'?<InvestmentChecklist key={id} securityId={id}/>:<SecurityDocuments key={id} securityId={id} onCountChange={setDocumentCount}/>}</Card>
    </SecurityDetailLayout>
    {editing&&<SecurityForm security={security} onClose={()=>setEditing(false)}/>}
  </main>
}
