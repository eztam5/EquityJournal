import { Fragment, useEffect, useState, type MouseEvent } from 'react'
import { Button, Icon, Menu, MenuDivider, MenuItem, PopoverNext, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Taxonomy, Watchlist } from '../domain/types'
import { ConfirmDialog, WatchlistForm } from './Forms'
import { buildTaxonomyTreeModel, type TaxonomyTreeModelNode } from './taxonomyTreeModel'
import { formatSecurityLabel } from '../utils/securityLabels'
import { WATCHLIST_DRAG_HOVER_EVENT } from '../utils/watchlistSecurityDrag'

function SectionHeader({ title, onAdd, menu }: { title: string; onAdd?: () => void; menu?:React.ReactNode }) { return <div className="sidebar-section-header"><span>{title}</span>{menu??(onAdd&&<Button variant="minimal" size="small" icon="add" onClick={onAdd} aria-label={`Add ${title}`}/>)}</div> }

function TaxonomyMarker({color,expanded,expandable}:{color:string;expanded?:boolean;expandable:boolean}){return <span className={`taxonomy-sidebar-marker ${expandable?'expandable':'leaf'}`} style={{'--tag-color':color} as React.CSSProperties}>{expandable&&<Icon icon={expanded?'chevron-down':'chevron-right'} size={10}/>}</span>}

export function Sidebar({ onNewSecurity, onNewWatchlist, onNewTaxonomy, onNewTopic }: { onNewSecurity():void;onNewWatchlist():void;onNewTaxonomy():void;onNewTopic():void }) {
  const app=useApp();const[dropTarget,setDropTarget]=useState('');const[deletingTaxonomy,setDeletingTaxonomy]=useState<Taxonomy>();const[deletingWatchlist,setDeletingWatchlist]=useState<Watchlist>();const[renamingWatchlist,setRenamingWatchlist]=useState<Watchlist>()
  const[expandedTaxonomyNodes,setExpandedTaxonomyNodes]=useState<Set<string>>(()=>new Set())
  const[taxonomyTrees,setTaxonomyTrees]=useState<Record<string,TaxonomyTreeModelNode[]>>({})
  const[loadingTaxonomies,setLoadingTaxonomies]=useState<Set<string>>(()=>new Set())
  const[taxonomyTreeErrors,setTaxonomyTreeErrors]=useState<Record<string,string>>({})
  useEffect(()=>{const update=(event:Event)=>setDropTarget((event as CustomEvent<string|null>).detail??'');window.addEventListener(WATCHLIST_DRAG_HOVER_EVENT,update);return()=>window.removeEventListener(WATCHLIST_DRAG_HOVER_EVENT,update)},[])
  const openDeleteMenu=(event:MouseEvent,onDelete:()=>void)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="trash" intent="danger" text="Delete" onClick={onDelete}/></Menu>})}
  const openWatchlistMenu=(event:MouseEvent,watchlist:Watchlist,index:number)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Rename" onClick={()=>setRenamingWatchlist(watchlist)}/><MenuItem icon="arrow-up" text="Move up" disabled={index===0} onClick={()=>app.moveWatchlist(watchlist.id,-1)}/><MenuItem icon="arrow-down" text="Move down" disabled={index===app.watchlists.length-1} onClick={()=>app.moveWatchlist(watchlist.id,1)}/><MenuDivider/><MenuItem icon="trash" intent="danger" text="Delete" onClick={()=>setDeletingWatchlist(watchlist)}/></Menu>})}
  const taxonomyNodeKey=(taxonomyId:string)=>`taxonomy:${taxonomyId}`
  const tagNodeKey=(tagId:string)=>`tag:${tagId}`
  const toggleTag=(tagId:string)=>setExpandedTaxonomyNodes((current)=>{const next=new Set(current),key=tagNodeKey(tagId);if(next.has(key))next.delete(key);else next.add(key);return next})
  const toggleTaxonomy=async(taxonomyId:string)=>{
    const key=taxonomyNodeKey(taxonomyId)
    if(expandedTaxonomyNodes.has(key)){setExpandedTaxonomyNodes((current)=>{const next=new Set(current);next.delete(key);return next});return}
    setExpandedTaxonomyNodes((current)=>new Set(current).add(key))
    setLoadingTaxonomies((current)=>new Set(current).add(taxonomyId))
    setTaxonomyTreeErrors((current)=>{const next={...current};delete next[taxonomyId];return next})
    try{
      const[tags,securities]=await Promise.all([app.repository.listTags(taxonomyId),app.repository.listTaggedSecurities(taxonomyId)])
      setTaxonomyTrees((current)=>({...current,[taxonomyId]:buildTaxonomyTreeModel(tags,securities)}))
    }catch(reason){
      setTaxonomyTreeErrors((current)=>({...current,[taxonomyId]:reason instanceof Error?reason.message:String(reason)}))
    }finally{
      setLoadingTaxonomies((current)=>{const next=new Set(current);next.delete(taxonomyId);return next})
    }
  }
  const renderTaxonomyNode=(node:TaxonomyTreeModelNode,depth:number):React.ReactNode=>{
    if(node.kind==='security'){const label=formatSecurityLabel(node.security,app.securityDisplayMode);return <Button key={node.id} fill alignText="start" variant="minimal" className={`nav-item taxonomy-sidebar-label taxonomy-security-item ${app.view.type==='security'&&app.view.id===node.security.id?'active':''}`} style={{'--taxonomy-depth':depth} as React.CSSProperties} icon="chart" text={label} title={label} onClick={()=>app.openSecurity(node.security.id)}/>}
    const key=tagNodeKey(node.id),isExpanded=expandedTaxonomyNodes.has(key),hasChildren=node.children.length>0
    const style={'--taxonomy-depth':depth} as React.CSSProperties
    const marker=<TaxonomyMarker color={node.tag.color} expanded={isExpanded} expandable={hasChildren}/>
    return <Fragment key={node.id}>{hasChildren?<Button fill alignText="start" variant="minimal" className="nav-item taxonomy-sidebar-tag" style={style} icon={marker} text={node.tag.name} title={node.tag.name} aria-label={`${isExpanded?'Collapse':'Expand'} ${node.tag.name}`} onClick={()=>toggleTag(node.id)}/>:<div className="nav-item taxonomy-sidebar-tag taxonomy-sidebar-leaf" style={style}>{marker}<span>{node.tag.name}</span></div>}{isExpanded&&node.children.map((child)=>renderTaxonomyNode(child,depth+1))}</Fragment>
  }
  return <><aside className="sidebar">
    <div className="sidebar-section"><SectionHeader title="Securities" menu={<PopoverNext content={<Menu className="sidebar-add-menu"><MenuItem icon="add" text="New security" onClick={onNewSecurity}/><MenuItem icon="folder-new" text="New watchlist" onClick={onNewWatchlist}/></Menu>} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button variant="minimal" size="small" icon="add" aria-label="Add security or watchlist"/></PopoverNext>}/>
      <Button fill alignText="start" variant="minimal" icon="th-list" className={`nav-item securities-list-item all-securities-item ${app.view.type==='all-securities'?'active':''}`} text="All Securities" onClick={()=>app.setView({type:'all-securities'})}/>
      {app.watchlists.map((item,index)=><Button key={item.id} fill alignText="start" variant="minimal" icon="th-list" data-watchlist-id={item.id} className={`nav-item securities-list-item ${app.view.type==='watchlist'&&app.view.id===item.id?'active':''} ${dropTarget===item.id?'drop-target':''}`} text={item.name} onClick={()=>app.setView({type:'watchlist',id:item.id})} onContextMenu={(event)=>openWatchlistMenu(event,item,index)}/>)}
    </div>
    <div className="sidebar-section"><SectionHeader title="Research" onAdd={onNewTopic}/><Button fill alignText="start" variant="minimal" icon="series-search" className={`nav-item research-topics-item ${app.view.type==='topics'||app.view.type==='topic'?'active':''}`} text="Topics" onClick={()=>app.setView({type:'topics'})}/></div>
    <div className="sidebar-section"><SectionHeader title="Taxonomies" onAdd={onNewTaxonomy}/>{app.taxonomies.map((item)=>{const key=taxonomyNodeKey(item.id),isExpanded=expandedTaxonomyNodes.has(key),tree=taxonomyTrees[item.id],isLoading=loadingTaxonomies.has(item.id),hasChildren=tree===undefined||tree.length>0;return <Fragment key={item.id}><div className="taxonomy-sidebar-row taxonomy-sidebar-root">{hasChildren?<Button variant="minimal" size="small" className="taxonomy-sidebar-toggle" icon={<TaxonomyMarker color={item.color} expanded={isExpanded} expandable/>} loading={isLoading} aria-label={`${isExpanded?'Collapse':'Expand'} ${item.name}`} onClick={()=>void toggleTaxonomy(item.id)}/>:<span className="taxonomy-sidebar-toggle-spacer"><TaxonomyMarker color={item.color} expandable={false}/></span>}<Button fill alignText="start" variant="minimal" className={`nav-item taxonomy-sidebar-label ${app.view.type==='taxonomy'&&app.view.id===item.id?'active':''}`} onClick={()=>app.setView({type:'taxonomy',id:item.id})} onContextMenu={(event)=>openDeleteMenu(event,()=>setDeletingTaxonomy(item))} text={item.name}/></div>{isExpanded&&tree?.map((node)=>renderTaxonomyNode(node,1))}{isExpanded&&taxonomyTreeErrors[item.id]&&<div className="taxonomy-sidebar-error">Could not load taxonomy.</div>}</Fragment>})}</div>
    {app.recent.length>0&&<div className="sidebar-section"><SectionHeader title="Recently Viewed"/>{app.recent.map((item)=><Button key={item.id} fill alignText="start" variant="minimal" icon="chart" className={`nav-item recent ${app.view.type==='security'&&app.view.id===item.id?'active':''}`} onClick={()=>app.openSecurity(item.id)} text={formatSecurityLabel(item,app.securityDisplayMode)}/>)}</div>}
  </aside>{renamingWatchlist&&<WatchlistForm watchlist={renamingWatchlist} onClose={()=>setRenamingWatchlist(undefined)}/>} {deletingWatchlist&&<ConfirmDialog title="Delete watchlist" message={`Do you really want to delete ${deletingWatchlist.name}? Securities in this list will not be deleted.`} confirmLabel="Delete" onClose={()=>setDeletingWatchlist(undefined)} onConfirm={()=>app.deleteWatchlist(deletingWatchlist.id)}/>} {deletingTaxonomy&&<ConfirmDialog title="Delete taxonomy" message={`Do you really want to delete ${deletingTaxonomy.name} and all of its tags?`} confirmLabel="Delete" onClose={()=>setDeletingTaxonomy(undefined)} onConfirm={()=>app.deleteTaxonomy(deletingTaxonomy.id)}/>}</>
}
