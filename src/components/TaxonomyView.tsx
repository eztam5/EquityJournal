import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Menu, MenuItem, Tree, type TreeNodeInfo, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { buildTagTree, type Tag, type TagNode } from '../domain/types'
import { ConfirmDialog, TagForm } from './Forms'

export function TaxonomyView({ id }: { id:string }) {
  const app=useApp();const taxonomy=app.taxonomies.find((x)=>x.id===id);const[tags,setTags]=useState<Tag[]>([]);const[expanded,setExpanded]=useState<Set<string>>(new Set(['root']));const[form,setForm]=useState<{parent?:Tag;tag?:Tag}|null>(null);const[deleting,setDeleting]=useState<Tag>();
  const load=useCallback(async()=>setTags(await app.listTags(id)),[app,id]);useEffect(()=>{load()},[load]);
  if(!taxonomy)return <main className="content page"><div className="empty-state">Taxonomy not found.</div></main>
  const toggle=(value:string)=>setExpanded((current)=>{const next=new Set(current);if(next.has(value))next.delete(value);else next.add(value);return next})
  const tree=buildTagTree(tags)
  const openMenu=(event:MouseEvent,tag?:Tag)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="add" text="Add Tag" onClick={()=>{setForm({parent:tag});if(tag)setExpanded((x)=>new Set(x).add(tag.id))}}/><MenuItem icon="edit" text="Edit Tag" disabled={!tag} onClick={()=>setForm({tag})}/><MenuItem icon="trash" intent="danger" text="Delete Tag" disabled={!tag} onClick={()=>setDeleting(tag)}/></Menu>})}
  const convert=(node:TagNode):TreeNodeInfo<Tag>=>({id:node.id,nodeData:node,label:<span className="taxonomy-node-label"><i style={{background:node.color}}/>{node.name}</span>,isExpanded:expanded.has(node.id),hasCaret:node.children.length>0,childNodes:node.children.map(convert)})
  const contents=useMemo<TreeNodeInfo<Tag|undefined>[]>(()=>[{id:'root',nodeData:undefined,label:<span className="taxonomy-node-label"><i style={{background:taxonomy.color}}/>{taxonomy.name}</span>,icon:'diagram-tree',isExpanded:expanded.has('root'),hasCaret:true,isSelected:true,childNodes:tree.map(convert)}],[taxonomy,tree,expanded])
  return <main className="content page"><header className="page-header"><div><h1>{taxonomy.name}</h1><p>{taxonomy.description||'Build a hierarchical classification for your research.'}</p></div></header>
    <div className="taxonomy-card"><Tree compact contents={contents} onNodeExpand={(node)=>toggle(String(node.id))} onNodeCollapse={(node)=>toggle(String(node.id))} onNodeContextMenu={(node,_path,event)=>openMenu(event,node.nodeData)}/></div>
    {form&&<TagForm taxonomy={taxonomy} parent={form.parent} tag={form.tag} onSaved={load} onClose={()=>setForm(null)}/>} {deleting&&<ConfirmDialog title="Delete tag" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={async()=>{await app.repository.deleteTag(id,deleting.id);await load()}}/>}
  </main>
}
