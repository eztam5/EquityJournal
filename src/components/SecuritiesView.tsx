import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { Button, HTMLTable, Menu, MenuItem, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { ConfirmDialog, SecurityForm } from './Forms'

export type SecuritySortKey = 'symbol'|'alternativeId'|'name'|'currency'
export type SortDirection = 'asc'|'desc'

export function sortSecurities(rows:Security[],key:SecuritySortKey,direction:SortDirection) {
  return rows.toSorted((left,right)=>{
    const comparison=left[key].localeCompare(right[key],undefined,{numeric:true,sensitivity:'base'})
    return comparison===0?left.id.localeCompare(right.id):direction==='asc'?comparison:-comparison
  })
}

function SortHeader({label,column,sortKey,direction,onSort}:{label:string;column:SecuritySortKey;sortKey:SecuritySortKey;direction:SortDirection;onSort(column:SecuritySortKey):void}) {
  const active=column===sortKey
  return <th aria-sort={active?(direction==='asc'?'ascending':'descending'):'none'}><Button className="sort-header" variant="minimal" size="small" alignText="start" text={label} rightIcon={active?(direction==='asc'?'sort-asc':'sort-desc'):undefined} onClick={()=>onSort(column)}/></th>
}

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp();const[rows,setRows]=useState<Security[]>([]);const[editing,setEditing]=useState<Security>();const[deleting,setDeleting]=useState<Security>();const[sortKey,setSortKey]=useState<SecuritySortKey>('symbol');const[direction,setDirection]=useState<SortDirection>('asc')
  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  const sortedRows=useMemo(()=>sortSecurities(rows,sortKey,direction),[rows,sortKey,direction])
  const sort=(column:SecuritySortKey)=>{if(column===sortKey)setDirection((current)=>current==='asc'?'desc':'asc');else{setSortKey(column);setDirection('asc')}}
  const title=watchlistId?app.watchlists.find((x)=>x.id===watchlistId)?.name??'Watchlist':'All Securities'
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Edit" onClick={()=>setEditing(security)}/><MenuItem icon="trash" intent="danger" text="Delete" onClick={()=>setDeleting(security)}/></Menu>})}
  const drag=(event:DragEvent,security:Security)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-equity-security',security.id)}
  return <main className="content page"><header className="page-header"><div><h1>{title}</h1><p>{rows.length} {rows.length===1?'security':'securities'}</p></div></header>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr><SortHeader label="Symbol" column="symbol" sortKey={sortKey} direction={direction} onSort={sort}/><SortHeader label="Alternative ID" column="alternativeId" sortKey={sortKey} direction={direction} onSort={sort}/><SortHeader label="Company" column="name" sortKey={sortKey} direction={direction} onSort={sort}/><SortHeader label="Currency" column="currency" sortKey={sortKey} direction={direction} onSort={sort}/><th aria-label="Actions"/></tr></thead><tbody>{sortedRows.map((security)=><tr key={security.id} draggable onDragStart={(e)=>drag(e,security)} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(e)=>openMenu(e,security)}><td className="symbol">{security.symbol}</td><td>{security.alternativeId||'—'}</td><td>{security.name}</td><td>{security.currency}</td><td><Button variant="minimal" size="small" icon="more" aria-label={`Actions for ${security.name}`} onClick={(e)=>openMenu(e,security)}/></td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>} 
  </main>
}
