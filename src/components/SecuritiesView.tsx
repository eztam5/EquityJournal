import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Button, HTMLTable, Icon, Menu, MenuItem, PopoverNext, showContextMenu, Tooltip } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { resolveSecurityLink } from '../data/repository'
import type { Security, SecurityLinkTemplate } from '../domain/types'
import { openExternalUrl } from '../utils/externalLinks'
import { announceWatchlistDragHover, watchlistDropTargetAt } from '../utils/watchlistSecurityDrag'
import { ConfirmDialog, SecurityForm } from './Forms'
import { PageHeader } from './PageHeader'

export type SecuritySortKey = 'symbol'|'alternativeId'|'name'|'currency'
export type SecurityColumnKey = SecuritySortKey|`link:${string}`
export type SortDirection = 'asc'|'desc'

export interface SecurityColumnPreferences {
  order: SecurityColumnKey[]
  visible: SecurityColumnKey[]
}

interface SecurityColumnDefinition {
  key: SecurityColumnKey
  label: string
  sortKey?: SecuritySortKey
  template?: SecurityLinkTemplate
}

const COLUMN_PREFERENCES_KEY = 'equity-journal.visible-security-columns'
const BUILTIN_COLUMNS: SecurityColumnDefinition[] = [
  {key:'symbol',label:'Symbol',sortKey:'symbol'},
  {key:'alternativeId',label:'Alternative ID',sortKey:'alternativeId'},
  {key:'name',label:'Company',sortKey:'name'},
  {key:'currency',label:'Currency',sortKey:'currency'},
]

const isColumnKey = (value: unknown): value is SecurityColumnKey => typeof value==='string'&&(BUILTIN_COLUMNS.some((column)=>column.key===value)||(value.startsWith('link:')&&value.length>5))
const isSecuritySortKey = (value: SecurityColumnKey): value is SecuritySortKey => BUILTIN_COLUMNS.some((column)=>column.key===value)
const uniqueColumnKeys = (values: unknown[]): SecurityColumnKey[] => [...new Set(values.filter(isColumnKey))]

export function loadSecurityColumnPreferences(): SecurityColumnPreferences {
  const defaults=BUILTIN_COLUMNS.map((column)=>column.key)
  try {
    const stored:unknown=JSON.parse(localStorage.getItem(COLUMN_PREFERENCES_KEY)??'null')
    if(stored&&typeof stored==='object'){
      const value=stored as {order?:unknown;visible?:unknown}
      if(Array.isArray(value.order)&&Array.isArray(value.visible)){
        const visible=uniqueColumnKeys(value.visible)
        const order=uniqueColumnKeys([...value.order,...visible,...defaults])
        if(visible.length)return{order,visible}
      }
    }
  }catch{/* Use the default layout when a stored preference is malformed. */}
  return{order:defaults,visible:defaults}
}

export function loadVisibleSecurityColumns(): SecurityColumnKey[] {
  return loadSecurityColumnPreferences().visible
}

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

function ColumnChooserRow({column,index,count,visible,lastVisible,onToggle,onMove}:{column:SecurityColumnDefinition;index:number;count:number;visible:boolean;lastVisible:boolean;onToggle():void;onMove(offset:number):void}) {
  return <li role="none" className="column-chooser-row">
    <button type="button" className="column-visibility-toggle" role="menuitemcheckbox" aria-checked={visible} aria-disabled={lastVisible} onClick={onToggle}>
      <span className="column-check">{visible&&<Icon icon="tick" size={13}/>}</span><span>{column.label}</span>{column.template&&<small aria-hidden="true">Link</small>}
    </button>
    <Button variant="minimal" size="small" icon="arrow-up" aria-label={`Move ${column.label} up`} disabled={index===0} onClick={()=>onMove(-1)}/>
    <Button variant="minimal" size="small" icon="arrow-down" aria-label={`Move ${column.label} down`} disabled={index===count-1} onClick={()=>onMove(1)}/>
  </li>
}

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp()
  const[rows,setRows]=useState<Security[]>([])
  const[editing,setEditing]=useState<Security>()
  const[deleting,setDeleting]=useState<Security>()
  const[preferences,setPreferences]=useState<SecurityColumnPreferences>(loadSecurityColumnPreferences)
  const[sortKey,setSortKey]=useState<SecuritySortKey>(()=>loadVisibleSecurityColumns().find(isSecuritySortKey)??'symbol')
  const[direction,setDirection]=useState<SortDirection>('asc')
  const pendingDrag=useRef<{security:Security;pointerId:number;x:number;y:number}|null>(null)
  const draggingSecurity=useRef<Security|null>(null)
  const hoveredWatchlistId=useRef<string|null>(null)

  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  useEffect(()=>{localStorage.setItem(COLUMN_PREFERENCES_KEY,JSON.stringify(preferences))},[preferences])

  const linkColumns:SecurityColumnDefinition[]=app.securityLinkTemplates.map((template)=>({key:`link:${template.id}`,label:template.linkText,template}))
  const availableColumns=[...BUILTIN_COLUMNS,...linkColumns]
  const availableKeys=availableColumns.map((column)=>column.key)
  const orderedColumns=[...availableColumns].toSorted((left,right)=>{
    const leftIndex=preferences.order.indexOf(left.key),rightIndex=preferences.order.indexOf(right.key)
    return (leftIndex<0?Number.MAX_SAFE_INTEGER:leftIndex)-(rightIndex<0?Number.MAX_SAFE_INTEGER:rightIndex)||availableKeys.indexOf(left.key)-availableKeys.indexOf(right.key)
  })
  const visibleColumns=orderedColumns.filter((column)=>preferences.visible.includes(column.key))

  useEffect(()=>{
    setPreferences((current)=>{
      const missing=availableKeys.filter((key)=>!current.order.includes(key))
      const hasVisible=availableKeys.some((key)=>current.visible.includes(key))
      if(!missing.length&&hasVisible)return current
      return{order:[...current.order,...missing],visible:hasVisible?current.visible:[...current.visible,'symbol']}
    })
  },[availableKeys.join('|')])

  useEffect(()=>{
    if(preferences.visible.includes(sortKey))return
    const next=visibleColumns.find((column)=>column.sortKey)?.sortKey
    if(next){setSortKey(next);setDirection('asc')}
  },[preferences.visible,sortKey,visibleColumns])

  const sortedRows=useMemo(()=>sortSecurities(rows,sortKey,direction),[rows,sortKey,direction])
  const sort=(column:SecuritySortKey)=>{if(column===sortKey)setDirection((current)=>current==='asc'?'desc':'asc');else{setSortKey(column);setDirection('asc')}}
  const toggleColumn=(column:SecurityColumnKey)=>setPreferences((current)=>{const visible=current.visible.includes(column);if(visible&&visibleColumns.length===1)return current;return{...current,visible:visible?current.visible.filter((key)=>key!==column):[...current.visible,column]}})
  const reorderColumn=(source:SecurityColumnKey,target:SecurityColumnKey)=>setPreferences((current)=>{const order=orderedColumns.map((column)=>column.key),sourceIndex=order.indexOf(source),targetIndex=order.indexOf(target);if(sourceIndex<0||targetIndex<0||sourceIndex===targetIndex)return current;order.splice(sourceIndex,1);order.splice(targetIndex,0,source);return{...current,order:[...order,...current.order.filter((key)=>!order.includes(key))]}})
  const moveColumn=(column:SecurityColumnKey,offset:number)=>{const index=orderedColumns.findIndex((item)=>item.key===column),target=orderedColumns[index+offset];if(target)reorderColumn(column,target.key)}
  const title=watchlistId?app.watchlists.find((watchlist)=>watchlist.id===watchlistId)?.name??'Watchlist':'All Securities'
  const removeOrDeleteLabel=watchlistId?'Remove from watchlist':'Delete'
  const removeFromWatchlist=async(security:Security)=>{if(!watchlistId)return;await app.repository.setWatchlistSecurity(watchlistId,security.id,false);setRows((current)=>current.filter((item)=>item.id!==security.id))}
  const removeOrRequestDelete=(security:Security)=>{if(watchlistId)void removeFromWatchlist(security);else setDeleting(security)}
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Edit" onClick={()=>setEditing(security)}/><MenuItem icon="trash" intent="danger" text={removeOrDeleteLabel} onClick={()=>removeOrRequestDelete(security)}/></Menu>})}
  const resetSecurityDrag=()=>{pendingDrag.current=null;draggingSecurity.current=null;hoveredWatchlistId.current=null;document.documentElement.classList.remove('watchlist-security-dragging');announceWatchlistDragHover(null)}
  const startSecurityDrag=(event:PointerEvent<HTMLTableRowElement>,security:Security)=>{if(event.button!==0||(event.target as Element).closest('button,a,input'))return;pendingDrag.current={security,pointerId:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture?.(event.pointerId)}
  const moveSecurityDrag=(event:PointerEvent<HTMLTableRowElement>)=>{const pending=pendingDrag.current;if(!draggingSecurity.current&&pending&&pending.pointerId===event.pointerId){if(Math.hypot(event.clientX-pending.x,event.clientY-pending.y)<5)return;draggingSecurity.current=pending.security;document.documentElement.classList.add('watchlist-security-dragging')}if(!draggingSecurity.current)return;event.preventDefault();const target=watchlistDropTargetAt(event.clientX,event.clientY);if(target!==hoveredWatchlistId.current){hoveredWatchlistId.current=target;announceWatchlistDragHover(target)}}
  const finishSecurityDrag=async(event:PointerEvent<HTMLTableRowElement>)=>{const security=draggingSecurity.current;const targetWatchlistId=watchlistDropTargetAt(event.clientX,event.clientY)??hoveredWatchlistId.current;event.currentTarget.releasePointerCapture?.(event.pointerId);if(!security){pendingDrag.current=null;return}event.preventDefault();event.stopPropagation();resetSecurityDrag();if(targetWatchlistId){await app.repository.setWatchlistSecurity(targetWatchlistId,security.id,true);await app.refresh()}}
  const renderRemoveOrDeleteButton=(security:Security)=>{const button=<Button variant="minimal" size="small" icon="trash" intent="danger" aria-label={`${watchlistId?'Remove':'Delete'} ${security.name}`} onClick={()=>removeOrRequestDelete(security)}/>;return watchlistId?<Tooltip key="remove" content="Remove from this watchlist. The security itself will not be deleted." placement="left">{button}</Tooltip>:button}

  const columnMenu=<Menu aria-label="Visible columns" className="column-chooser">{orderedColumns.map((column,index)=><ColumnChooserRow key={column.key} column={column} index={index} count={orderedColumns.length} visible={preferences.visible.includes(column.key)} lastVisible={preferences.visible.includes(column.key)&&visibleColumns.length===1} onToggle={()=>toggleColumn(column.key)} onMove={(offset)=>moveColumn(column.key,offset)}/>)}</Menu>

  const renderHeader=(column:SecurityColumnDefinition)=>column.sortKey?<SortHeader key={column.key} label={column.label} column={column.sortKey} sortKey={sortKey} direction={direction} onSort={sort}/>:<th key={column.key}>{column.label}</th>
  const renderCell=(column:SecurityColumnDefinition,security:Security)=>{
    if(column.key==='symbol')return <td className="symbol" key={column.key}>{security.symbol}</td>
    if(column.key==='alternativeId')return <td key={column.key}>{security.alternativeId||'—'}</td>
    if(column.key==='name')return <td key={column.key}>{security.name}</td>
    if(column.key==='currency')return <td key={column.key}>{security.currency}</td>
    const url=column.template?resolveSecurityLink(column.template,security):null
    return <td className="security-link-cell" key={column.key}><Button variant="minimal" size="small" icon="share" text="Open" aria-label={`Open ${column.label}`} disabled={!url} title={url?`Open ${column.label}`:`Set an Alternative ID to use ${column.label}`} onClick={(event)=>{event.stopPropagation();if(url)void openExternalUrl(url)}}/></td>
  }

  return <main className="content page"><PageHeader title={title} description={`${rows.length} ${rows.length===1?'security':'securities'}`} actions={<PopoverNext content={columnMenu} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button className="page-toolbar-button" icon="properties" text="Columns"/></PopoverNext>}/>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr>{visibleColumns.map(renderHeader)}<th aria-label="Actions"/></tr></thead><tbody>{sortedRows.map((security)=><tr key={security.id} className="security-draggable-row" onPointerDown={(event)=>startSecurityDrag(event,security)} onPointerMove={moveSecurityDrag} onPointerUp={(event)=>void finishSecurityDrag(event)} onPointerCancel={resetSecurityDrag} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(event)=>openMenu(event,security)}>{visibleColumns.map((column)=>renderCell(column,security))}<td><Button variant="minimal" size="small" icon="edit" aria-label={`Edit ${security.name}`} onClick={()=>setEditing(security)}/>{renderRemoveOrDeleteButton(security)}</td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Permanently delete ${deleting.name} from the database?`} confirmLabel="Delete" onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>}
  </main>
}
