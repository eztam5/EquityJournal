import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Button, Checkbox, Section, SectionCard } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { buildTagTree, type Tag, type TagNode } from '../domain/types'
import { formatSecurityLabel } from '../utils/securityLabels'
import { DialogActions, DraggableDialog } from './DraggableDialog'

function TagRuleChoice({node,selected,onChange,depth=0}:{node:TagNode;selected:Set<string>;onChange(id:string,checked:boolean):void;depth?:number}) {
  return <><Checkbox className="tag-choice" style={{marginInlineStart:depth*22}} checked={selected.has(node.id)} onChange={(event)=>onChange(node.id,event.currentTarget.checked)} labelElement={<span className="tag-choice-label"><i style={{background:node.color}}/>{node.name}</span>}/>{node.children.map((child)=><TagRuleChoice key={child.id} node={child} selected={selected} onChange={onChange} depth={depth+1}/>)}</>
}

export function ResearchTopicRelationsDialog({topicId,onClose,onSaved}:{topicId:string;onClose():void;onSaved():void}) {
  const app=useApp();const[direct,setDirect]=useState<Set<string>>(new Set());const[rules,setRules]=useState<Set<string>>(new Set());const[tags,setTags]=useState<Map<string,Tag[]>>(new Map());const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[error,setError]=useState('')
  useEffect(()=>{
    let active=true
    setLoading(true)
    Promise.all([app.repository.getResearchTopicRelations(topicId),...app.taxonomies.map((taxonomy)=>app.repository.listTags(taxonomy.id))])
      .then(([relations,...groups])=>{
        if(!active)return
        setDirect(new Set(relations.directSecurityIds));setRules(new Set(relations.tagIds))
        setTags(new Map(app.taxonomies.map((taxonomy,index)=>[taxonomy.id,groups[index]])))
      })
      .catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:String(reason))})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[app.repository,app.taxonomies,topicId])
  const toggle=(setter:Dispatch<SetStateAction<Set<string>>>,id:string,checked:boolean)=>setter((current)=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next})
  const save=async()=>{setSaving(true);setError('');try{await app.repository.setResearchTopicRelations(topicId,[...direct],[...rules]);await app.refresh();onSaved();onClose()}catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setSaving(false)}}
  return <DraggableDialog title="Manage related securities" onClose={onClose} width={680}>{loading?<div className="empty-state">Loading related securities…</div>:<div className="topic-relations-editor"><section><h3>Individual securities</h3><p className="muted">These securities remain related regardless of their classifications.</p><div className="topic-relation-choices">{app.securities.map((security)=><Checkbox key={security.id} checked={direct.has(security.id)} label={formatSecurityLabel(security,app.securityDisplayMode)} onChange={(event)=>toggle(setDirect,security.id,event.currentTarget.checked)}/>)}{app.securities.length===0&&<p className="muted">No securities available.</p>}</div></section><section><h3>Automatically include by classification</h3><p className="muted">A selected tag automatically includes securities assigned to that tag or any of its child tags. Multiple rules match any selected tag.</p><div className="assignment-list topic-tag-rules">{app.taxonomies.map((taxonomy)=><Section key={taxonomy.id} title={taxonomy.name} icon="diagram-tree" compact><SectionCard>{buildTagTree(tags.get(taxonomy.id)??[]).map((node)=><TagRuleChoice key={node.id} node={node} selected={rules} onChange={(id,checked)=>toggle(setRules,id,checked)}/>)}</SectionCard></Section>)}{app.taxonomies.length===0&&<p className="muted">Create a taxonomy and tags first.</p>}</div></section></div>}{error&&<p className="form-error">{error}</p>}<DialogActions><Button text="Cancel" onClick={onClose}/><Button intent="primary" text="Save" loading={saving} disabled={loading} onClick={save}/></DialogActions></DraggableDialog>
}
