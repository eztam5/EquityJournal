import { useState, type FormEvent } from 'react'
import { Button, Callout, FormGroup, InputGroup, TextArea, Tooltip } from '@blueprintjs/core'
import type { ResearchTopic, Security, Tag, Taxonomy, Watchlist } from '../domain/types'
import { useApp } from '../app/AppContext'
import { DialogActions, DraggableDialog } from './DraggableDialog'
import { notifyTaxonomyTreeChanged } from '../utils/taxonomyTreeChanges'
import { fetchYahooPriceHistory, type YahooPriceHistory } from '../utils/yahooFinance'
import { PriceSparkline } from './SecurityPriceChart'

const COLORS = ['#4F7CAC','#2E8B78','#7A5AF8','#C47F17','#C25555','#9B5C8F','#667085','#3478C9']
function ErrorText({ error }: { error: string }) { return error ? <Callout className="form-error" intent="danger" role="alert">{error}</Callout> : null }
function ColorPicker({ value, onChange }: { value: string; onChange(value: string): void }) { return <div className="color-picker">{COLORS.map((color) => <Tooltip key={color} content={color}><Button type="button" aria-label={`Select color ${color}`} className={value === color ? 'selected':''} style={{background:color}} onClick={()=>onChange(color)} icon={value===color?'tick':undefined}/></Tooltip>)}</div> }

export function SecurityForm({ security, onClose }: { security?: Security; onClose(): void }) {
  const app=useApp(),[symbol,setSymbol]=useState(security?.symbol??''),[alternativeId,setAlternativeId]=useState(security?.alternativeId??''),[currency,setCurrency]=useState(security?.currency??''),[name,setName]=useState(security?.name??''),[error,setError]=useState(''),[priceTest,setPriceTest]=useState<YahooPriceHistory>(),[priceError,setPriceError]=useState(''),[testingPrices,setTestingPrices]=useState(false),[saving,setSaving]=useState(false)
  const testPrices=async()=>{setTestingPrices(true);setPriceError('');setPriceTest(undefined);try{setPriceTest(await fetchYahooPriceHistory(symbol,'1mo'))}catch(reason){setPriceError(reason instanceof Error?reason.message:String(reason))}finally{setTestingPrices(false)}}
  const submit=async(event:FormEvent)=>{event.preventDefault();setError('');setSaving(true);try{if(security)await app.updateSecurity({...security,symbol,alternativeId,currency,name});else await app.addSecurity({symbol,alternativeId,currency,name});onClose()}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setSaving(false)}}
  return <DraggableDialog title={security?'Edit security':'New security'} onClose={onClose}><form onSubmit={submit} className="form-grid">
    <FormGroup label="Company name" labelFor="security-name"><InputGroup id="security-name" autoFocus maxLength={160} value={name} onChange={(event)=>setName(event.target.value)} placeholder="For example, Apple Inc."/></FormGroup>
    <FormGroup label="Symbol" labelFor="security-symbol" helperText="Use Test prices to confirm that Yahoo Finance recognizes the symbol."><InputGroup id="security-symbol" maxLength={20} value={symbol} onChange={(event)=>{setSymbol(event.target.value);setPriceTest(undefined);setPriceError('')}} placeholder="For example, AAPL" rightElement={<Button type="button" variant="minimal" text="Test prices" loading={testingPrices} disabled={!symbol.trim()} onClick={()=>void testPrices()}/>} /></FormGroup>
    {priceTest&&<div className="security-price-preview" aria-label="Yahoo Finance price preview"><div><strong>{priceTest.companyName||priceTest.symbol}</strong><span>{priceTest.symbol}{priceTest.exchangeName?` · ${priceTest.exchangeName}`:''}{priceTest.currency?` · ${priceTest.currency}`:''}</span></div><PriceSparkline prices={priceTest.prices}/><small>{priceTest.prices.length} recent daily prices loaded successfully</small></div>}
    {priceError&&<Callout className="form-error" intent="warning" role="alert">{priceError}</Callout>}
    <FormGroup label="Alternative ID" labelInfo="(optional)" labelFor="security-alternative-id"><InputGroup id="security-alternative-id" maxLength={80} value={alternativeId} onChange={(event)=>setAlternativeId(event.target.value)} placeholder="For example, US0378331005"/></FormGroup>
    <FormGroup label="Currency" labelFor="security-currency"><InputGroup id="security-currency" maxLength={8} value={currency} onChange={(event)=>setCurrency(event.target.value)} placeholder="For example, USD"/></FormGroup>
    <ErrorText error={error}/><DialogActions><Button text="Cancel" onClick={onClose} disabled={saving}/><Button type="submit" intent="primary" text="Save" loading={saving} disabled={!symbol.trim()||!currency.trim()||!name.trim()}/></DialogActions>
  </form></DraggableDialog>
}

export function WatchlistForm({ watchlist, onClose }: { watchlist?:Watchlist;onClose(): void }) {
  const app=useApp();const[name,setName]=useState(watchlist?.name??'');const[error,setError]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();try{if(watchlist)await app.updateWatchlist({...watchlist,name});else await app.addWatchlist(name);onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={watchlist?'Rename watchlist':'New watchlist'} onClose={onClose} width={420}><form onSubmit={submit} className="form-grid"><FormGroup label="List name" labelFor="watchlist-name"><InputGroup id="watchlist-name" autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Watchlist"/></FormGroup><ErrorText error={error}/><DialogActions><Button text="Cancel" onClick={onClose}/><Button type="submit" intent="primary" text="Save" disabled={!name.trim()}/></DialogActions></form></DraggableDialog>
}

export function TaxonomyForm({ taxonomy, onClose }: { taxonomy?:Taxonomy;onClose(): void }) {
  const app=useApp();const[name,setName]=useState(taxonomy?.name??'');const[description,setDescription]=useState(taxonomy?.description??'');const[color,setColor]=useState(taxonomy?.color??COLORS[0]);const[error,setError]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();try{if(taxonomy)await app.updateTaxonomy({id:taxonomy.id,name,description,color});else await app.addTaxonomy({name,description,color});onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={taxonomy?'Edit taxonomy':'New taxonomy'} onClose={onClose}><form onSubmit={submit} className="form-grid"><FormGroup label="Name" labelFor="taxonomy-name"><InputGroup id="taxonomy-name" autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Investment Thesis"/></FormGroup><FormGroup label="Description" labelInfo="(optional)" labelFor="taxonomy-description"><TextArea id="taxonomy-description" fill value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe the purpose of this taxonomy"/></FormGroup><FormGroup label="Color"><ColorPicker value={color} onChange={setColor}/></FormGroup><ErrorText error={error}/><DialogActions><Button text="Cancel" onClick={onClose}/><Button type="submit" intent="primary" text="Save" disabled={!name.trim()}/></DialogActions></form></DraggableDialog>
}

export function ResearchTopicForm({topic,onClose}:{topic?:ResearchTopic;onClose():void}) {
  const app=useApp();const[title,setTitle]=useState(topic?.title??'');const[error,setError]=useState('')
  const submit=async(event:FormEvent)=>{event.preventDefault();setError('');try{if(topic)await app.updateResearchTopic({id:topic.id,title});else await app.addResearchTopic(title);onClose()}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}}
  return <DraggableDialog title={topic?'Edit research topic':'New research topic'} onClose={onClose} width={520}><form onSubmit={submit} className="form-grid"><FormGroup label="Topic title" labelFor="research-topic-title"><InputGroup id="research-topic-title" autoFocus maxLength={180} value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="For example, Serial acquirers in vertical-market software"/></FormGroup><ErrorText error={error}/><DialogActions><Button text="Cancel" onClick={onClose}/><Button type="submit" intent="primary" text="Save" disabled={!title.trim()}/></DialogActions></form></DraggableDialog>
}

export function TagForm({ taxonomy, parent, tag, onSaved, onClose }: { taxonomy: Taxonomy; parent?: Tag; tag?: Tag; onSaved(): void; onClose(): void }) {
  const app=useApp();const[name,setName]=useState(tag?.name??'');const[description,setDescription]=useState(tag?.description??'');const[color,setColor]=useState(tag?.color||parent?.color||taxonomy.color);const[error,setError]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();try{if(tag)await app.repository.updateTag({id:tag.id,taxonomyId:taxonomy.id,name,description,color});else await app.repository.addTag({taxonomyId:taxonomy.id,parentId:parent?.id??null,name,description,color});await onSaved();notifyTaxonomyTreeChanged(taxonomy.id);onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={tag?'Edit tag':'New tag'} onClose={onClose}><form onSubmit={submit} className="form-grid">{!tag&&<Callout className="form-context" icon="diagram-tree">Parent: {parent?.name??taxonomy.name}</Callout>}<FormGroup label="Name" labelFor="tag-name"><InputGroup id="tag-name" autoFocus maxLength={80} value={name} onChange={(e)=>setName(e.target.value)} placeholder="For example, Strong pricing power"/></FormGroup><FormGroup label="Description" labelInfo="(optional)" labelFor="tag-description"><TextArea id="tag-description" fill value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Describe how this tag should be used"/></FormGroup><FormGroup label="Color"><ColorPicker value={color} onChange={setColor}/></FormGroup><ErrorText error={error}/><DialogActions><Button text="Cancel" onClick={onClose}/><Button type="submit" intent="primary" text="Save" disabled={!name.trim()}/></DialogActions></form></DraggableDialog>
}

export function ConfirmDialog({ title, message, confirmLabel='Yes', onConfirm, onClose }: { title:string;message:string;confirmLabel?:string;onConfirm():Promise<void>;onClose():void }) {
  const[error,setError]=useState('');const confirm=async()=>{try{await onConfirm();onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title={title} onClose={onClose} width={460}><Callout intent="danger" icon="warning-sign">{message}</Callout><ErrorText error={error}/><DialogActions><Button text="No" onClick={onClose}/><Button intent="danger" text={confirmLabel} onClick={confirm}/></DialogActions></DraggableDialog>
}
