import { useEffect, useState } from 'react'
import { Button, Checkbox, Section, SectionCard } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { buildTagTree, type Tag, type TagNode } from '../domain/types'
import { DialogActions, DraggableDialog } from './DraggableDialog'

function Choice({node,selected,onChange,depth=0}:{node:TagNode;selected:Set<string>;onChange(id:string,checked:boolean):void;depth?:number}){return <><Checkbox className="tag-choice" style={{marginInlineStart:depth*22}} checked={selected.has(node.id)} onChange={(e)=>onChange(node.id,e.currentTarget.checked)} labelElement={<span className="tag-choice-label"><i style={{background:node.color}}/>{node.name}</span>}/>{node.children.map((child)=><Choice key={child.id} node={child} selected={selected} onChange={onChange} depth={depth+1}/>)}</>}

export function TagAssignmentDialog({securityId,onClose,onSaved}:{securityId:string;onClose():void;onSaved():void}){
  const app=useApp();const[tags,setTags]=useState<Map<string,Tag[]>>(new Map());const[selected,setSelected]=useState<Set<string>>(new Set());const[error,setError]=useState('')
  useEffect(()=>{Promise.all([app.repository.assignedTagIds(securityId),...app.taxonomies.map((x)=>app.repository.listTags(x.id))]).then(([ids,...groups])=>{setSelected(new Set(ids));setTags(new Map(app.taxonomies.map((x,index)=>[x.id,groups[index]])))})},[app.repository,app.taxonomies,securityId])
  const save=async()=>{try{await app.repository.setAssignedTags(securityId,[...selected]);onSaved();onClose()}catch(r){setError(r instanceof Error?r.message:String(r))}}
  return <DraggableDialog title="Assign classifications" onClose={onClose} width={560}><div className="assignment-list">{app.taxonomies.map((taxonomy)=><Section key={taxonomy.id} title={taxonomy.name} icon="diagram-tree" compact><SectionCard>{buildTagTree(tags.get(taxonomy.id)??[]).map((node)=><Choice key={node.id} node={node} selected={selected} onChange={(id,checked)=>setSelected((current)=>{const next=new Set(current);if(checked)next.add(id);else next.delete(id);return next})}/>)}</SectionCard></Section>)}{app.taxonomies.length===0&&<p className="muted">Create a taxonomy and tags first.</p>}</div>{error&&<p className="form-error">{error}</p>}<DialogActions><Button text="Cancel" onClick={onClose}/><Button intent="primary" text="Save" onClick={save}/></DialogActions></DraggableDialog>
}
