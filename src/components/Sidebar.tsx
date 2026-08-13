import { useState, type DragEvent } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useApp } from '../app/AppContext'

function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) { return <div className="sidebar-section-header"><span>{title}</span>{onAdd&&<button className="icon-button" onClick={onAdd} aria-label={`Add ${title}`}><Plus size={16}/></button>}</div> }

export function Sidebar({ onNewSecurity, onNewWatchlist, onNewTaxonomy }: { onNewSecurity():void;onNewWatchlist():void;onNewTaxonomy():void }) {
  const app=useApp();const[addOpen,setAddOpen]=useState(false);const[dropTarget,setDropTarget]=useState('')
  const drop=async(event:DragEvent,watchlistId:string)=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-equity-security');setDropTarget('');if(id){await app.repository.setWatchlistSecurity(watchlistId,id,true);if(app.view.type==='watchlist'&&app.view.id===watchlistId)await app.refresh()}}
  return <aside className="sidebar">
    <div className="sidebar-section"><SectionHeader title="Securities" onAdd={()=>setAddOpen(!addOpen)}/>{addOpen&&<div className="popover add-menu"><button onClick={()=>{setAddOpen(false);onNewSecurity()}}>New security</button><button onClick={()=>{setAddOpen(false);onNewWatchlist()}}>New watchlist</button></div>}
      <button className={`nav-item ${app.view.type==='all-securities'?'active':''}`} onClick={()=>app.setView({type:'all-securities'})}>All Securities</button>
      {app.watchlists.map((item)=><button key={item.id} className={`nav-item ${app.view.type==='watchlist'&&app.view.id===item.id?'active':''} ${dropTarget===item.id?'drop-target':''}`} onClick={()=>app.setView({type:'watchlist',id:item.id})} onDragOver={(e)=>{e.preventDefault();setDropTarget(item.id)}} onDragLeave={()=>setDropTarget('')} onDrop={(e)=>drop(e,item.id)}>{item.name}</button>)}
    </div>
    <div className="sidebar-section"><SectionHeader title="Taxonomies" onAdd={onNewTaxonomy}/>{app.taxonomies.map((item)=><button key={item.id} className={`nav-item ${app.view.type==='taxonomy'&&app.view.id===item.id?'active':''}`} onClick={()=>app.setView({type:'taxonomy',id:item.id})}><i className="nav-marker" style={{background:item.color}}/>{item.name}</button>)}</div>
    {app.recent.length>0&&<div className="sidebar-section"><SectionHeader title="Recently Viewed"/>{app.recent.map((item,index)=><button key={item.id} className={`nav-item recent ${app.view.type==='security'&&app.view.id===item.id?'active':''}`} onClick={()=>app.openSecurity(item.id)}>{index===0&&app.view.type==='security'&&app.view.id===item.id?<ChevronDown size={13}/>:null}<span>{item.symbol} — {item.name}</span></button>)}</div>}
  </aside>
}
