import { useEffect, useState, type DragEvent, type MouseEvent } from 'react'
import { Button, HTMLTable, Menu, MenuItem, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { ConfirmDialog, SecurityForm } from './Forms'

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp();const[rows,setRows]=useState<Security[]>([]);const[editing,setEditing]=useState<Security>();const[deleting,setDeleting]=useState<Security>();
  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  const title=watchlistId?app.watchlists.find((x)=>x.id===watchlistId)?.name??'Watchlist':'All Securities'
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Edit" onClick={()=>setEditing(security)}/><MenuItem icon="trash" intent="danger" text="Delete" onClick={()=>setDeleting(security)}/></Menu>})}
  const drag=(event:DragEvent,security:Security)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-equity-security',security.id)}
  return <main className="content page"><header className="page-header"><div><h1>{title}</h1><p>{rows.length} {rows.length===1?'security':'securities'}</p></div></header>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr><th>Symbol</th><th>Company</th><th>Currency</th><th aria-label="Actions"/></tr></thead><tbody>{rows.map((security)=><tr key={security.id} draggable onDragStart={(e)=>drag(e,security)} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(e)=>openMenu(e,security)}><td className="symbol">{security.symbol}</td><td>{security.name}</td><td>{security.currency}</td><td><Button variant="minimal" size="small" icon="more" aria-label={`Actions for ${security.name}`} onClick={(e)=>openMenu(e,security)}/></td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>} 
  </main>
}
