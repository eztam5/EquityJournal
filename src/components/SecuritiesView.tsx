import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { ConfirmDialog, SecurityForm } from './Forms'

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp();const[rows,setRows]=useState<Security[]>([]);const[menu,setMenu]=useState<{x:number;y:number;security:Security}|null>(null);const[editing,setEditing]=useState<Security>();const[deleting,setDeleting]=useState<Security>();
  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  const title=watchlistId?app.watchlists.find((x)=>x.id===watchlistId)?.name??'Watchlist':'All Securities'
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();setMenu({x:event.clientX,y:event.clientY,security})}
  const drag=(event:DragEvent,security:Security)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-equity-security',security.id)}
  return <main className="content page"><header className="page-header"><div><h1>{title}</h1><p>{rows.length} {rows.length===1?'security':'securities'}</p></div></header>
    <div className="data-card"><table className="security-table"><thead><tr><th>Symbol</th><th>Company</th><th>Currency</th><th aria-label="Actions"/></tr></thead><tbody>{rows.map((security)=><tr key={security.id} draggable onDragStart={(e)=>drag(e,security)} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(e)=>openMenu(e,security)}><td className="symbol">{security.symbol}</td><td>{security.name}</td><td>{security.currency}</td><td><button className="icon-button" onClick={(e)=>openMenu(e,security)}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {menu&&<div className="popover context-menu" style={{left:menu.x,top:menu.y}} onMouseLeave={()=>setMenu(null)}><button onClick={()=>{setEditing(menu.security);setMenu(null)}}>Edit</button><button className="destructive" onClick={()=>{setDeleting(menu.security);setMenu(null)}}>Delete</button></div>}
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>} 
  </main>
}
