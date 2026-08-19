import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { Button, HTMLTable, Icon, Menu, MenuItem, PopoverNext, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { resolveSecurityLink } from '../data/repository'
import type { Security, SecurityLinkTemplate } from '../domain/types'
import { openExternalUrl } from '../utils/externalLinks'
import { ConfirmDialog, SecurityForm } from './Forms'

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
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Edit" onClick={()=>setEditing(security)}/><MenuItem icon="trash" intent="danger" text="Delete" onClick={()=>setDeleting(security)}/></Menu>})}
  const dragSecurity=(event:DragEvent,security:Security)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-equity-security',security.id)}

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

  return <main className="content page"><header className="page-header"><div><h1>{title}</h1><p>{rows.length} {rows.length===1?'security':'securities'}</p></div><PopoverNext content={columnMenu} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button icon="properties" text="Columns"/></PopoverNext></header>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr>{visibleColumns.map(renderHeader)}<th aria-label="Actions"/></tr></thead><tbody>{sortedRows.map((security)=><tr key={security.id} draggable onDragStart={(event)=>dragSecurity(event,security)} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(event)=>openMenu(event,security)}>{visibleColumns.map((column)=>renderCell(column,security))}<td><Button variant="minimal" size="small" icon="edit" aria-label={`Edit ${security.name}`} onClick={()=>setEditing(security)}/><Button variant="minimal" size="small" icon="trash" intent="danger" aria-label={`Delete ${security.name}`} onClick={()=>setDeleting(security)}/></td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>} 
  </main>
}
