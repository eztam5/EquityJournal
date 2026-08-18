import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { Button, HTMLTable, Menu, MenuDivider, MenuItem, PopoverNext, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { resolveSecurityLink } from '../data/repository'
import { openExternalUrl } from '../utils/externalLinks'
import { ConfirmDialog, SecurityForm } from './Forms'

export type SecuritySortKey = 'symbol'|'alternativeId'|'name'|'currency'
export type SecurityColumnKey = SecuritySortKey|`link:${string}`
export type SortDirection = 'asc'|'desc'
const VISIBLE_COLUMNS_KEY = 'equity-journal.visible-security-columns'
const SECURITY_COLUMNS: Array<{key:SecuritySortKey;label:string}> = [{key:'symbol',label:'Symbol'},{key:'alternativeId',label:'Alternative ID'},{key:'name',label:'Company'},{key:'currency',label:'Currency'}]

const isSecuritySortKey = (value: string): value is SecuritySortKey => SECURITY_COLUMNS.some((column)=>column.key===value)

export function loadVisibleSecurityColumns(): SecurityColumnKey[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(VISIBLE_COLUMNS_KEY) ?? 'null')
    if (Array.isArray(stored)) {
      const selectedStatic = SECURITY_COLUMNS.map((column)=>column.key).filter((key)=>stored.includes(key))
      const selectedLinks = stored.filter((value):value is `link:${string}`=>typeof value==='string'&&value.startsWith('link:')&&value.length>5)
      const selected = [...selectedStatic,...new Set(selectedLinks)]
      if (selected.length) return selected
    }
  } catch { /* Fall back to all columns if the preference is malformed. */ }
  return SECURITY_COLUMNS.map((column)=>column.key)
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

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp();const[rows,setRows]=useState<Security[]>([]);const[editing,setEditing]=useState<Security>();const[deleting,setDeleting]=useState<Security>();const[visibleColumns,setVisibleColumns]=useState<SecurityColumnKey[]>(loadVisibleSecurityColumns);const[sortKey,setSortKey]=useState<SecuritySortKey>(()=>loadVisibleSecurityColumns().find(isSecuritySortKey)??'symbol');const[direction,setDirection]=useState<SortDirection>('asc')
  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  useEffect(()=>{localStorage.setItem(VISIBLE_COLUMNS_KEY,JSON.stringify(visibleColumns))},[visibleColumns])
  const linkColumns=app.securityLinkTemplates.map((template)=>({key:`link:${template.id}` as const,label:template.linkText,template}))
  const availableColumnKeys:SecurityColumnKey[]=[...SECURITY_COLUMNS.map((column)=>column.key),...linkColumns.map((column)=>column.key)]
  const sortedRows=useMemo(()=>sortSecurities(rows,sortKey,direction),[rows,sortKey,direction])
  const sort=(column:SecuritySortKey)=>{if(column===sortKey)setDirection((current)=>current==='asc'?'desc':'asc');else{setSortKey(column);setDirection('asc')}}
  const toggleColumn=(column:SecurityColumnKey)=>setVisibleColumns((current)=>{const selected=current.includes(column),visibleAvailable=availableColumnKeys.filter((key)=>current.includes(key));if(selected&&visibleAvailable.length===1)return current;const next=availableColumnKeys.filter((key)=>selected?current.includes(key)&&key!==column:current.includes(key)||key===column);if(!next.includes(sortKey)){setSortKey(next.find(isSecuritySortKey)??'symbol');setDirection('asc')}return next})
  const title=watchlistId?app.watchlists.find((x)=>x.id===watchlistId)?.name??'Watchlist':'All Securities'
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:<Menu><MenuItem icon="edit" text="Edit" onClick={()=>setEditing(security)}/><MenuItem icon="trash" intent="danger" text="Delete" onClick={()=>setDeleting(security)}/></Menu>})}
  const drag=(event:DragEvent,security:Security)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-equity-security',security.id)}
  const visibleAvailableCount=availableColumnKeys.filter((key)=>visibleColumns.includes(key)).length
  const columnItem=(column:{key:SecurityColumnKey;label:string})=>{const visible=visibleColumns.includes(column.key);return <MenuItem key={column.key} role="menuitemcheckbox" aria-checked={visible} icon={visible?'tick':undefined} text={column.label} disabled={visible&&visibleAvailableCount===1} shouldDismissPopover={false} onClick={()=>toggleColumn(column.key)}/>}
  const columnMenu=<Menu aria-label="Visible columns">{SECURITY_COLUMNS.map(columnItem)}{linkColumns.length>0&&<><MenuDivider title="External links"/>{linkColumns.map(columnItem)}</>}</Menu>
  return <main className="content page"><header className="page-header"><div><h1>{title}</h1><p>{rows.length} {rows.length===1?'security':'securities'}</p></div><PopoverNext content={columnMenu} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button icon="properties" text="Columns"/></PopoverNext></header>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr>{visibleColumns.includes('symbol')&&<SortHeader label="Symbol" column="symbol" sortKey={sortKey} direction={direction} onSort={sort}/>} {visibleColumns.includes('alternativeId')&&<SortHeader label="Alternative ID" column="alternativeId" sortKey={sortKey} direction={direction} onSort={sort}/>} {visibleColumns.includes('name')&&<SortHeader label="Company" column="name" sortKey={sortKey} direction={direction} onSort={sort}/>} {visibleColumns.includes('currency')&&<SortHeader label="Currency" column="currency" sortKey={sortKey} direction={direction} onSort={sort}/>} {linkColumns.filter((column)=>visibleColumns.includes(column.key)).map((column)=><th key={column.key}>{column.label}</th>)}<th aria-label="Actions"/></tr></thead><tbody>{sortedRows.map((security)=><tr key={security.id} draggable onDragStart={(e)=>drag(e,security)} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(e)=>openMenu(e,security)}>{visibleColumns.includes('symbol')&&<td className="symbol">{security.symbol}</td>}{visibleColumns.includes('alternativeId')&&<td>{security.alternativeId||'—'}</td>}{visibleColumns.includes('name')&&<td>{security.name}</td>}{visibleColumns.includes('currency')&&<td>{security.currency}</td>}{linkColumns.filter((column)=>visibleColumns.includes(column.key)).map((column)=>{const url=resolveSecurityLink(column.template,security);return <td className="security-link-cell" key={column.key}><Button variant="minimal" size="small" icon="share" text="Open" disabled={!url} title={url?`Open ${column.label}`:`Set an Alternative ID to use ${column.label}`} onClick={(event)=>{event.stopPropagation();if(url)void openExternalUrl(url)}}/></td>})}<td><Button variant="minimal" size="small" icon="more" aria-label={`Actions for ${security.name}`} onClick={(e)=>openMenu(e,security)}/></td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state">No securities yet.</div>}</div>
    {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Do you really want to delete ${deleting.name}?`} onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>} 
  </main>
}
