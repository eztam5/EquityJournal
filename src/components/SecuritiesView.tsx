import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Button, HTMLTable, Icon, InputGroup, Menu, MenuItem, PopoverNext, showContextMenu } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import { resolveSecurityLink } from '../data/repository'
import type { Security, SecurityPrice } from '../domain/types'
import { openExternalUrl } from '../utils/externalLinks'
import { copyHtmlTableToClipboard, copyTextToClipboard, csvFileName, exportTableAsCsv, exportTableAsHtml, saveCsvExport, type ExportTable } from '../utils/tableExport'
import { announceWatchlistDragHover, isAdditiveSelectionModifier, watchlistDropTargetAt } from '../utils/watchlistSecurityDrag'
import { PRICE_HISTORY_CHANGED_EVENT } from '../utils/priceUpdates'
import { SecurityLinkIcon } from './SecurityLinkIcon'
import { ConfirmDialog, SecurityForm } from './Forms'
import { PageHeader, PageToolbarIconBar, PageToolbarIconButton } from './PageHeader'

export type SecuritySortKey = 'symbol'|'alternativeId'|'name'|'currency'|'todayChange'
export type SecurityColumnKey = SecuritySortKey|'links'
export type SortDirection = 'asc'|'desc'

export interface SecurityColumnPreferences {
  order: SecurityColumnKey[]
  visible: SecurityColumnKey[]
  version: number
}

interface SecurityColumnDefinition {
  key: SecurityColumnKey
  label: string
  sortKey?: SecuritySortKey
}

const COLUMN_PREFERENCES_KEY = 'equity-journal.visible-security-columns'
const COLUMN_PREFERENCES_VERSION = 3
const BUILTIN_COLUMNS: SecurityColumnDefinition[] = [
  {key:'symbol',label:'Symbol',sortKey:'symbol'},
  {key:'alternativeId',label:'Alternative ID',sortKey:'alternativeId'},
  {key:'name',label:'Company',sortKey:'name'},
  {key:'currency',label:'Currency',sortKey:'currency'},
  {key:'todayChange',label:'Today %',sortKey:'todayChange'},
  {key:'links',label:'Links'},
]

const isColumnKey = (value: unknown): value is SecurityColumnKey => typeof value==='string'&&BUILTIN_COLUMNS.some((column)=>column.key===value)
const isSecuritySortKey = (value: SecurityColumnKey): value is SecuritySortKey => value==='symbol'||value==='alternativeId'||value==='name'||value==='currency'||value==='todayChange'
const uniqueColumnKeys = (values: unknown[]): SecurityColumnKey[] => [...new Set(values.map((value)=>typeof value==='string'&&value.startsWith('link:')?'links':value).filter(isColumnKey))]

export function loadSecurityColumnPreferences(): SecurityColumnPreferences {
  const defaults=BUILTIN_COLUMNS.map((column)=>column.key)
  try {
    const stored:unknown=JSON.parse(localStorage.getItem(COLUMN_PREFERENCES_KEY)??'null')
    if(stored&&typeof stored==='object'){
      const value=stored as {order?:unknown;visible?:unknown;version?:unknown}
      if(Array.isArray(value.order)&&Array.isArray(value.visible)){
        const visible=uniqueColumnKeys(value.visible)
        const order=uniqueColumnKeys([...value.order,...visible,...defaults])
        if(visible.length){
          const migratedVisible:SecurityColumnKey[]=(typeof value.version==='number'&&value.version>=2)||visible.includes('todayChange')?visible:[...visible,'todayChange']
          return{order,visible:migratedVisible,version:COLUMN_PREFERENCES_VERSION}
        }
      }
    }
  }catch{/* Use the default layout when a stored preference is malformed. */}
  return{order:defaults,visible:defaults,version:COLUMN_PREFERENCES_VERSION}
}

export function loadVisibleSecurityColumns(): SecurityColumnKey[] {
  return loadSecurityColumnPreferences().visible
}

export function sortSecurities(rows:Security[],key:SecuritySortKey,direction:SortDirection,todayChanges:Record<string,number>={}) {
  return rows.toSorted((left,right)=>{
    const comparison=key==='todayChange'?(todayChanges[left.id]??0)-(todayChanges[right.id]??0):left[key].localeCompare(right[key],undefined,{numeric:true,sensitivity:'base'})
    return comparison===0?left.id.localeCompare(right.id):direction==='asc'?comparison:-comparison
  })
}

export function localPriceDate(now=new Date()):string {
  const pad=(value:number)=>String(value).padStart(2,'0')
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
}

export function todayPriceChange(prices:SecurityPrice[],today=localPriceDate()):number {
  const ordered=prices.toSorted((left,right)=>left.priceDate.localeCompare(right.priceDate)),latest=ordered.at(-1),previous=ordered.at(-2)
  if(!latest||!previous||latest.priceDate!==today||previous.close<=0)return 0
  return (latest.close/previous.close-1)*100
}

export function formatTodayPriceChange(change:number):string {
  return `${change>0?'+':''}${change.toFixed(2)}%`
}

function SortHeader({label,column,sortKey,direction,onSort}:{label:string;column:SecuritySortKey;sortKey:SecuritySortKey;direction:SortDirection;onSort(column:SecuritySortKey):void}) {
  const active=column===sortKey
  return <th aria-sort={active?(direction==='asc'?'ascending':'descending'):'none'}><Button className="sort-header" variant="minimal" size="small" alignText="start" text={label} rightIcon={active?(direction==='asc'?'sort-asc':'sort-desc'):undefined} onClick={()=>onSort(column)}/></th>
}

function ColumnChooserRow({column,index,count,visible,lastVisible,onToggle,onMove}:{column:SecurityColumnDefinition;index:number;count:number;visible:boolean;lastVisible:boolean;onToggle():void;onMove(offset:number):void}) {
  return <li role="none" className="column-chooser-row">
    <button type="button" className="column-visibility-toggle" role="menuitemcheckbox" aria-checked={visible} aria-disabled={lastVisible} onClick={onToggle}>
      <span className="column-check">{visible&&<Icon icon="tick" size={13}/>}</span><span>{column.label}</span>
    </button>
    <Button variant="minimal" size="small" icon="arrow-up" aria-label={`Move ${column.label} up`} disabled={index===0} onClick={()=>onMove(-1)}/>
    <Button variant="minimal" size="small" icon="arrow-down" aria-label={`Move ${column.label} down`} disabled={index===count-1} onClick={()=>onMove(1)}/>
  </li>
}

export function SecuritiesView({ watchlistId }: { watchlistId?: string }) {
  const app=useApp()
  const[rows,setRows]=useState<Security[]>([])
  const[todayChanges,setTodayChanges]=useState<Record<string,number>>({})
  const[creating,setCreating]=useState(false)
  const[editing,setEditing]=useState<Security>()
  const[deleting,setDeleting]=useState<Security>()
  const[preferences,setPreferences]=useState<SecurityColumnPreferences>(loadSecurityColumnPreferences)
  const[sortKey,setSortKey]=useState<SecuritySortKey>(()=>loadVisibleSecurityColumns().find(isSecuritySortKey)??'symbol')
  const[direction,setDirection]=useState<SortDirection>('asc')
  const[searchQuery,setSearchQuery]=useState('')
  const[exportStatus,setExportStatus]=useState('')
  const[selectedSecurityIds,setSelectedSecurityIds]=useState<Set<string>>(()=>new Set())
  const pendingDrag=useRef<{securities:Security[];pointerId:number;x:number;y:number}|null>(null)
  const draggingSecurities=useRef<Security[]>([])
  const hoveredWatchlistId=useRef<string|null>(null)
  const suppressSelectionClick=useRef(false)
  const selectionAnchorId=useRef<string|null>(null)

  useEffect(()=>{app.repository.listSecurities(watchlistId).then(setRows)},[app.repository,app.securities,watchlistId])
  useEffect(()=>{
    let active=true,request=0
    const load=async()=>{
      const current=++request
      const values=await Promise.all(rows.map(async(security)=>[security.id,todayPriceChange((await app.repository.listSecurityPrices(security.id)).filter((price)=>price.sourceSymbol.toUpperCase()===security.symbol.toUpperCase()))] as const))
      if(active&&current===request)setTodayChanges(Object.fromEntries(values))
    }
    void load()
    const refresh=()=>void load()
    window.addEventListener(PRICE_HISTORY_CHANGED_EVENT,refresh)
    return()=>{active=false;window.removeEventListener(PRICE_HISTORY_CHANGED_EVENT,refresh)}
  },[app.repository,rows])
  useEffect(()=>{selectionAnchorId.current=null;setSelectedSecurityIds(new Set());setSearchQuery('')},[watchlistId])
  useEffect(()=>setSelectedSecurityIds((current)=>{const visibleIds=new Set(rows.map((row)=>row.id));if(selectionAnchorId.current&&!visibleIds.has(selectionAnchorId.current))selectionAnchorId.current=null;const next=new Set([...current].filter((id)=>visibleIds.has(id)));return next.size===current.size?current:next}),[rows])
  useEffect(()=>{const clear=(event:KeyboardEvent)=>{if(event.key==='Escape'){selectionAnchorId.current=null;setSelectedSecurityIds(new Set())}};document.addEventListener('keydown',clear);return()=>document.removeEventListener('keydown',clear)},[])
  useEffect(()=>{localStorage.setItem(COLUMN_PREFERENCES_KEY,JSON.stringify(preferences))},[preferences])

  const availableColumns=BUILTIN_COLUMNS.filter((column)=>column.key!=='links'||app.securityLinkTemplates.length>0)
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
      return{...current,order:[...current.order,...missing],visible:hasVisible?current.visible:[...current.visible,'symbol']}
    })
  },[availableKeys.join('|')])

  useEffect(()=>{
    if(preferences.visible.includes(sortKey))return
    const next=visibleColumns.find((column)=>column.sortKey)?.sortKey
    if(next){setSortKey(next);setDirection('asc')}
  },[preferences.visible,sortKey,visibleColumns])

  const filteredRows=useMemo(()=>{const query=searchQuery.trim().toLocaleLowerCase();return query?rows.filter((security)=>security.symbol.toLocaleLowerCase().includes(query)||security.name.toLocaleLowerCase().includes(query)):rows},[rows,searchQuery])
  const sortedRows=useMemo(()=>sortSecurities(filteredRows,sortKey,direction,todayChanges),[filteredRows,sortKey,direction,todayChanges])
  const sort=(column:SecuritySortKey)=>{if(column===sortKey)setDirection((current)=>current==='asc'?'desc':'asc');else{setSortKey(column);setDirection('asc')}}
  const toggleColumn=(column:SecurityColumnKey)=>setPreferences((current)=>{const visible=current.visible.includes(column);if(visible&&visibleColumns.length===1)return current;return{...current,visible:visible?current.visible.filter((key)=>key!==column):[...current.visible,column]}})
  const reorderColumn=(source:SecurityColumnKey,target:SecurityColumnKey)=>setPreferences((current)=>{const order=orderedColumns.map((column)=>column.key),sourceIndex=order.indexOf(source),targetIndex=order.indexOf(target);if(sourceIndex<0||targetIndex<0||sourceIndex===targetIndex)return current;order.splice(sourceIndex,1);order.splice(targetIndex,0,source);return{...current,order:[...order,...current.order.filter((key)=>!order.includes(key))]}})
  const moveColumn=(column:SecurityColumnKey,offset:number)=>{const index=orderedColumns.findIndex((item)=>item.key===column),target=orderedColumns[index+offset];if(target)reorderColumn(column,target.key)}
  const title=watchlistId?app.watchlists.find((watchlist)=>watchlist.id===watchlistId)?.name??'Watchlist':'All Securities'
  const tableForExport:ExportTable={headers:visibleColumns.map((column)=>column.label),rows:sortedRows.map((security)=>visibleColumns.map((column)=>{
    if(column.key==='symbol')return{text:security.symbol}
    if(column.key==='alternativeId')return{text:security.alternativeId}
    if(column.key==='name')return{text:security.name}
    if(column.key==='currency')return{text:security.currency}
    if(column.key==='todayChange')return{text:formatTodayPriceChange(todayChanges[security.id]??0)}
    return{text:app.securityLinkTemplates.map((template)=>resolveSecurityLink(template,security)).filter(Boolean).join(' | ')}
  }))}
  const csvExport=exportTableAsCsv(tableForExport)
  const runExport=async(action:()=>Promise<void|boolean>,success:string)=>{setExportStatus('');try{if(await action()!==false)setExportStatus(success)}catch(reason){setExportStatus(`Export failed: ${reason instanceof Error?reason.message:String(reason)}`)}}
  const removeFromWatchlist=async(security:Security)=>{if(!watchlistId)return;await app.repository.setWatchlistSecurity(watchlistId,security.id,false);setRows((current)=>current.filter((item)=>item.id!==security.id))}
  const securityMenu=(security:Security)=><Menu><MenuItem icon="edit" text={watchlistId?'Edit':'Edit security'} onClick={()=>setEditing(security)}/>{watchlistId&&<MenuItem icon="remove" text="Remove from watchlist" onClick={()=>void removeFromWatchlist(security)}/>}<MenuItem icon="trash" intent="danger" text="Delete security" onClick={()=>setDeleting(security)}/></Menu>
  const openMenu=(event:MouseEvent,security:Security)=>{event.preventDefault();showContextMenu({targetOffset:{left:event.clientX,top:event.clientY},isDarkTheme:document.documentElement.classList.contains('bp6-dark'),content:securityMenu(security)})}
  const selectSecurity=(event:MouseEvent<HTMLTableRowElement>,security:Security)=>{if((event.target as Element).closest('button,a,input')||suppressSelectionClick.current){suppressSelectionClick.current=false;return}const additive=isAdditiveSelectionModifier(event);const anchorIndex=selectionAnchorId.current?sortedRows.findIndex((row)=>row.id===selectionAnchorId.current):-1;const targetIndex=sortedRows.findIndex((row)=>row.id===security.id);if(event.shiftKey&&anchorIndex>=0&&targetIndex>=0){const [start,end]=anchorIndex<targetIndex?[anchorIndex,targetIndex]:[targetIndex,anchorIndex];const rangeIds=sortedRows.slice(start,end+1).map((row)=>row.id);setSelectedSecurityIds((current)=>additive?new Set([...current,...rangeIds]):new Set(rangeIds));return}selectionAnchorId.current=security.id;setSelectedSecurityIds((current)=>{if(!additive)return new Set([security.id]);const next=new Set(current);if(next.has(security.id))next.delete(security.id);else next.add(security.id);return next})}
  const resetSecurityDrag=()=>{pendingDrag.current=null;draggingSecurities.current=[];hoveredWatchlistId.current=null;document.documentElement.classList.remove('watchlist-security-dragging');document.documentElement.removeAttribute('data-watchlist-drag-count');announceWatchlistDragHover(null)}
  const startSecurityDrag=(event:PointerEvent<HTMLTableRowElement>,security:Security)=>{if(event.button!==0||(event.target as Element).closest('button,a,input'))return;const securities=selectedSecurityIds.has(security.id)?sortedRows.filter((row)=>selectedSecurityIds.has(row.id)):[security];pendingDrag.current={securities,pointerId:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture?.(event.pointerId)}
  const moveSecurityDrag=(event:PointerEvent<HTMLTableRowElement>)=>{const pending=pendingDrag.current;if(!draggingSecurities.current.length&&pending&&pending.pointerId===event.pointerId){if(Math.hypot(event.clientX-pending.x,event.clientY-pending.y)<5)return;draggingSecurities.current=pending.securities;document.documentElement.classList.add('watchlist-security-dragging');document.documentElement.dataset.watchlistDragCount=String(pending.securities.length)}if(!draggingSecurities.current.length)return;event.preventDefault();const target=watchlistDropTargetAt(event.clientX,event.clientY);if(target!==hoveredWatchlistId.current){hoveredWatchlistId.current=target;announceWatchlistDragHover(target)}}
  const finishSecurityDrag=async(event:PointerEvent<HTMLTableRowElement>)=>{const securities=draggingSecurities.current;const targetWatchlistId=watchlistDropTargetAt(event.clientX,event.clientY)??hoveredWatchlistId.current;event.currentTarget.releasePointerCapture?.(event.pointerId);if(!securities.length){pendingDrag.current=null;return}event.preventDefault();event.stopPropagation();suppressSelectionClick.current=true;window.setTimeout(()=>{suppressSelectionClick.current=false},0);resetSecurityDrag();if(targetWatchlistId){for(const security of securities)await app.repository.setWatchlistSecurity(targetWatchlistId,security.id,true);await app.refresh()}}
  const columnMenu=<Menu aria-label="Visible columns" className="column-chooser">{orderedColumns.map((column,index)=><ColumnChooserRow key={column.key} column={column} index={index} count={orderedColumns.length} visible={preferences.visible.includes(column.key)} lastVisible={preferences.visible.includes(column.key)&&visibleColumns.length===1} onToggle={()=>toggleColumn(column.key)} onMove={(offset)=>moveColumn(column.key,offset)}/>)}</Menu>
  const exportMenu=<Menu aria-label="Export table" className="table-export-menu"><MenuItem icon="clipboard" text="Export as CSV to Clipboard" onClick={()=>void runExport(()=>copyTextToClipboard(csvExport),'CSV copied to clipboard')}/><MenuItem icon="th" text="Export as HTML table to Clipboard" onClick={()=>void runExport(()=>copyHtmlTableToClipboard(exportTableAsHtml(tableForExport),csvExport),'HTML table copied to clipboard')}/><MenuItem icon="floppy-disk" text="Export as CSV to File" onClick={()=>void runExport(()=>saveCsvExport(csvExport,csvFileName(title)),'CSV file saved')}/></Menu>

  const renderHeader=(column:SecurityColumnDefinition)=>column.sortKey?<SortHeader key={column.key} label={column.label} column={column.sortKey} sortKey={sortKey} direction={direction} onSort={sort}/>:<th key={column.key}>{column.label}</th>
  const renderCell=(column:SecurityColumnDefinition,security:Security)=>{
    if(column.key==='symbol')return <td className="symbol" key={column.key}>{security.symbol}</td>
    if(column.key==='alternativeId')return <td key={column.key}>{security.alternativeId||'—'}</td>
    if(column.key==='name')return <td key={column.key}>{security.name}</td>
    if(column.key==='currency')return <td key={column.key}>{security.currency}</td>
    if(column.key==='todayChange'){
      const change=todayChanges[security.id]??0
      return <td className={`security-daily-change${change>0?' positive':change<0?' negative':''}`} key={column.key} aria-label={formatTodayPriceChange(change)}><span className="security-change-display"><span aria-hidden="true">{change>0?'▲':change<0?'▼':'—'}</span><span className="security-change-value">{Math.abs(change).toFixed(2)}%</span></span></td>
    }
    const links=app.securityLinkTemplates.flatMap((template)=>{const url=resolveSecurityLink(template,security);return url?[{...template,url}]:[]})
    return <td className="security-link-cell" key={column.key}><div className="security-table-links">{links.length?links.map((link)=><Button key={link.id} variant="minimal" size="small" icon={<SecurityLinkIcon path={link.faviconPath}/>} aria-label={`Open ${link.linkText}`} title={link.url} onDoubleClick={(event)=>event.stopPropagation()} onClick={(event)=>{event.stopPropagation();void openExternalUrl(link.url)}}/>):'—'}</div></td>
  }

  const searching=searchQuery.trim().length>0
  const description=searching?`${filteredRows.length} of ${rows.length} ${rows.length===1?'security':'securities'}`:`${rows.length} ${rows.length===1?'security':'securities'}`
  return <main className="content page"><PageHeader title={title} description={<>{description}{exportStatus&&<span className="export-status" role="status"> · {exportStatus}</span>}</>} actions={<PageToolbarIconBar label="Security controls"><InputGroup className="security-search" type="search" leftIcon="search" placeholder="Search securities" aria-label="Search securities" value={searchQuery} onChange={(event)=>setSearchQuery(event.target.value)} rightElement={searchQuery?<Button variant="minimal" icon="cross" aria-label="Clear search" onClick={()=>setSearchQuery('')}/>:undefined}/><PageToolbarIconButton icon="add" label="New security" onClick={()=>setCreating(true)}/><PopoverNext content={exportMenu} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><PageToolbarIconButton icon="export" label="Export"/></PopoverNext><PopoverNext content={columnMenu} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><PageToolbarIconButton icon="properties" label="Columns"/></PopoverNext></PageToolbarIconBar>}/>
    <div className="content-panel data-card"><HTMLTable className="security-table" compact interactive striped><thead><tr>{visibleColumns.map(renderHeader)}<th aria-label="Actions"/></tr></thead><tbody>{sortedRows.map((security)=>{const selected=selectedSecurityIds.has(security.id);return <tr key={security.id} className={`security-draggable-row ${selected?'security-selected':''}`} aria-selected={selected} onClick={(event)=>selectSecurity(event,security)} onPointerDown={(event)=>startSecurityDrag(event,security)} onPointerMove={moveSecurityDrag} onPointerUp={(event)=>void finishSecurityDrag(event)} onPointerCancel={resetSecurityDrag} onDoubleClick={()=>app.openSecurity(security.id)} onContextMenu={(event)=>openMenu(event,security)}>{visibleColumns.map((column)=>renderCell(column,security))}<td><PopoverNext content={securityMenu(security)} placement="bottom-end" animation="minimal" arrow={false} shouldReturnFocusOnClose={false}><Button variant="minimal" size="small" icon="more" aria-label={`Actions for ${security.name}`}/></PopoverNext></td></tr>})}</tbody></HTMLTable>{rows.length===0?<div className="empty-state">No securities yet.</div>:searching&&filteredRows.length===0?<div className="empty-state">No securities match “{searchQuery.trim()}”.</div>:null}</div>
    {creating&&<SecurityForm onClose={()=>setCreating(false)}/>} {editing&&<SecurityForm security={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete security" message={`Permanently delete ${deleting.name} from the database?`} confirmLabel="Delete" onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteSecurity(deleting.id)}/>}
  </main>
}
