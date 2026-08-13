import { useState, type DragEvent } from 'react'
import { Button, Menu, MenuItem, PopoverNext } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'

function SectionHeader({ title, onAdd, menu }: { title: string; onAdd?: () => void; menu?:React.ReactNode }) { return <div className="sidebar-section-header"><span>{title}</span>{menu??(onAdd&&<Button variant="minimal" size="small" icon="add" onClick={onAdd} aria-label={`Add ${title}`}/>)}</div> }

export function Sidebar({ onNewSecurity, onNewWatchlist, onNewTaxonomy }: { onNewSecurity():void;onNewWatchlist():void;onNewTaxonomy():void }) {
  const app=useApp();const[dropTarget,setDropTarget]=useState('')
  const drop=async(event:DragEvent,watchlistId:string)=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-equity-security');setDropTarget('');if(id){await app.repository.setWatchlistSecurity(watchlistId,id,true);if(app.view.type==='watchlist'&&app.view.id===watchlistId)await app.refresh()}}
  return <aside className="sidebar">
    <div className="sidebar-section"><SectionHeader title="Securities" menu={<PopoverNext content={<Menu><MenuItem icon="add" text="New security" onClick={onNewSecurity}/><MenuItem icon="folder-new" text="New watchlist" onClick={onNewWatchlist}/></Menu>} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button variant="minimal" size="small" icon="add" aria-label="Add security or watchlist"/></PopoverNext>}/>
      <Button fill alignText="start" variant="minimal" className={`nav-item ${app.view.type==='all-securities'?'active':''}`} text="All Securities" onClick={()=>app.setView({type:'all-securities'})}/>
      {app.watchlists.map((item)=><Button key={item.id} fill alignText="start" variant="minimal" className={`nav-item ${app.view.type==='watchlist'&&app.view.id===item.id?'active':''} ${dropTarget===item.id?'drop-target':''}`} text={item.name} onClick={()=>app.setView({type:'watchlist',id:item.id})} onDragOver={(e)=>{e.preventDefault();setDropTarget(item.id)}} onDragLeave={()=>setDropTarget('')} onDrop={(e)=>drop(e,item.id)}/>)}
    </div>
    <div className="sidebar-section"><SectionHeader title="Taxonomies" onAdd={onNewTaxonomy}/>{app.taxonomies.map((item)=><Button key={item.id} fill alignText="start" variant="minimal" className={`nav-item ${app.view.type==='taxonomy'&&app.view.id===item.id?'active':''}`} onClick={()=>app.setView({type:'taxonomy',id:item.id})} icon={<i className="nav-marker" style={{background:item.color}}/>} text={item.name}/>)}</div>
    {app.recent.length>0&&<div className="sidebar-section"><SectionHeader title="Recently Viewed"/>{app.recent.map((item,index)=><Button key={item.id} fill alignText="start" variant="minimal" className={`nav-item recent ${app.view.type==='security'&&app.view.id===item.id?'active':''}`} onClick={()=>app.openSecurity(item.id)} icon={index===0&&app.view.type==='security'&&app.view.id===item.id?'caret-down':undefined} text={`${item.symbol} — ${item.name}`}/>)}</div>}
  </aside>
}
