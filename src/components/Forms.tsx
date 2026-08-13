import { useEffect, useState, type FormEvent } from 'react'
import type { Security, Tag, Taxonomy } from '../domain/types'
import { useApp } from '../app/AppContext'
import { DialogActions, DraggableDialog } from './DraggableDialog'

const COLORS = ['#4F7CAC','#2E8B78','#7A5AF8','#C47F17','#C25555','#9B5C8F','#667085','#3478C9']
function ErrorText({ error }: { error: string }) { return error ? <p className="form-error" role="alert">{error}</p> : null }
function ColorPicker({ value, onChange }: { value: string; onChange(value: string): void }) { return <div className="color-picker">{COLORS.map((color) => <button type="button" key={color} aria-label={`Select color ${color}`} className={value === color ? 'selected' : ''} style={{ background: color }} onClick={() => onChange(color)}/>)}</div> }

export function SecurityForm({ security, onClose }: { security?: Security; onClose(): void }) {
  const app = useApp(); const [symbol,setSymbol]=useState(security?.symbol ?? ''); const [currency,setCurrency]=useState(security?.currency ?? ''); const [name,setName]=useState(security?.name ?? ''); const [error,setError]=useState('')
  const submit=async(event:FormEvent)=>{event.preventDefault();setError('');try{if(security)await app.updateSecurity({...security,symbol,currency,name});else await app.addSecurity({symbol,currency,name});onClose()}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}
  return <DraggableDialog title={security?'Edit security':'New security'} onClose={onClose}><form onSubmit={submit} className="form-grid"><label>Symbol<input autoFocus maxLength={20} value={symbol} onChange={(e)=>setSymbol(e.target.value)} placeholder="For example, AAPL"/></label><label>Currency<input maxLength={8} value={currency} onChange={(e)=>setCurrency(e.target.value)} placeholder="For example, USD"/></label><label>Company name<input maxLength={160} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Apple Inc."/></label><ErrorText error={error}/><DialogActions><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!symbol.trim()||!currency.trim()||!name.trim()}>Save</button></DialogActions></form></DraggableDialog>
}

export function WatchlistForm({ onClose }: { onClose(): void }) {
  const app=useApp();const[name,setName]=useState('');const[error,setError]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();try{await app.addWatchlist(name);onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title="New watchlist" onClose={onClose} width={420}><form onSubmit={submit} className="form-grid"><label>List name<input autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Watchlist"/></label><ErrorText error={error}/><DialogActions><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!name.trim()}>Save</button></DialogActions></form></DraggableDialog>
}

export function TaxonomyForm({ onClose }: { onClose(): void }) {
  const app=useApp();const[name,setName]=useState('');const[description,setDescription]=useState('');const[color,setColor]=useState(COLORS[0]);const[error,setError]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();try{await app.addTaxonomy({name,description,color});onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title="New taxonomy" onClose={onClose}><form onSubmit={submit} className="form-grid"><label>Name<input autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Investment Thesis"/></label><label>Description <span>(optional)</span><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe the purpose of this taxonomy"/></label><fieldset><legend>Color</legend><ColorPicker value={color} onChange={setColor}/></fieldset><ErrorText error={error}/><DialogActions><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!name.trim()}>Save</button></DialogActions></form></DraggableDialog>
}

export function TagForm({ taxonomy, parent, tag, onSaved, onClose }: { taxonomy: Taxonomy; parent?: Tag; tag?: Tag; onSaved(): void; onClose(): void }) {
  const app=useApp();const[name,setName]=useState(tag?.name??'');const[description,setDescription]=useState(tag?.description??'');const[color,setColor]=useState(tag?.color||parent?.color||taxonomy.color);const[error,setError]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();try{if(tag)await app.repository.updateTag({id:tag.id,taxonomyId:taxonomy.id,name,description,color});else await app.repository.addTag({taxonomyId:taxonomy.id,parentId:parent?.id??null,name,description,color});await onSaved();onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={tag?'Edit tag':'New tag'} onClose={onClose}><form onSubmit={submit} className="form-grid">{!tag&&<p className="form-context">Parent: {parent?.name??taxonomy.name}</p>}<label>Name<input autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Strong pricing power"/></label><label>Description <span>(optional)</span><textarea value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe how this tag should be used"/></label><fieldset><legend>Color</legend><ColorPicker value={color} onChange={setColor}/></fieldset><ErrorText error={error}/><DialogActions><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={!name.trim()}>Save</button></DialogActions></form></DraggableDialog>
}

export function ConfirmDialog({ title, message, confirmLabel='Yes', onConfirm, onClose }: { title:string;message:string;confirmLabel?:string;onConfirm():Promise<void>;onClose():void }) {
  const[error,setError]=useState('');const confirm=async()=>{try{await onConfirm();onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={title} onClose={onClose} width={460}><p>{message}</p><ErrorText error={error}/><DialogActions><button onClick={onClose}>No</button><button className="danger" onClick={confirm}>{confirmLabel}</button></DialogActions></DraggableDialog>
}
