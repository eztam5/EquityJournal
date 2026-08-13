import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, Tags } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { buildTagTree, type Tag, type TagNode } from '../domain/types'
import { ConfirmDialog, TagForm } from './Forms'

function TreeItem({ node, depth, expanded, toggle, menu }: { node:TagNode;depth:number;expanded:Set<string>;toggle(id:string):void;menu(event:MouseEvent,node:Tag):void }) {
  const open=expanded.has(node.id);return <><div className="tree-row" style={{paddingLeft:16+depth*24}} onContextMenu={(e)=>menu(e,node)}>{node.children.length?<button className="tree-toggle" onClick={()=>toggle(node.id)}>{open?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>:<span className="tree-toggle-spacer"/>}<i style={{background:node.color}}/><span>{node.name}</span></div>{open&&node.children.map((child)=><TreeItem key={child.id} node={child} depth={depth+1} expanded={expanded} toggle={toggle} menu={menu}/>)}</>
}

export function TaxonomyView({ id }: { id:string }) {
  const app=useApp();const taxonomy=app.taxonomies.find((x)=>x.id===id);const[tags,setTags]=useState<Tag[]>([]);const[expanded,setExpanded]=useState<Set<string>>(new Set(['root']));const[menu,setMenu]=useState<{x:number;y:number;tag?:Tag}|null>(null);const[form,setForm]=useState<{parent?:Tag;tag?:Tag}|null>(null);const[deleting,setDeleting]=useState<Tag>();
  const load=useCallback(async()=>setTags(await app.listTags(id)),[app,id]);useEffect(()=>{load()},[load]);
  if(!taxonomy)return <main className="content page"><div className="empty-state">Taxonomy not found.</div></main>
  const toggle=(value:string)=>setExpanded((current)=>{const next=new Set(current);if(next.has(value))next.delete(value);else next.add(value);return next})
  const openMenu=(event:MouseEvent,tag?:Tag)=>{event.preventDefault();setMenu({x:event.clientX,y:event.clientY,tag})}
  const tree=buildTagTree(tags)
  return <main className="content page"><header className="page-header"><div><h1>{taxonomy.name}</h1><p>{taxonomy.description||'Build a hierarchical classification for your research.'}</p></div></header>
    <div className="taxonomy-card"><div className="tree-row root active" onContextMenu={(e)=>openMenu(e)}><button className="tree-toggle" onClick={()=>toggle('root')}>{expanded.has('root')?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button><i style={{background:taxonomy.color}}/><Tags size={17}/><strong>{taxonomy.name}</strong></div>{expanded.has('root')&&tree.map((node)=><TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} menu={openMenu}/>)}</div>
    {menu&&<div className="popover context-menu" style={{left:menu.x,top:menu.y}} onMouseLeave={()=>setMenu(null)}><button onClick={()=>{setForm({parent:menu.tag});if(menu.tag)setExpanded((x)=>new Set(x).add(menu.tag!.id));setMenu(null)}}>Add Tag</button><button disabled={!menu.tag} onClick={()=>{setForm({tag:menu.tag});setMenu(null)}}>Edit Tag</button><button disabled={!menu.tag} className="destructive" onClick={()=>{setDeleting(menu.tag);setMenu(null)}}>Delete Tag</button></div>}
    {form&&<TagForm taxonomy={taxonomy} parent={form.parent} tag={form.tag} onSaved={load} onClose={()=>setForm(null)}/>} {deleting&&<ConfirmDialog title="Delete tag" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={async()=>{await app.repository.deleteTag(id,deleting.id);await load()}}/>}
  </main>
}
