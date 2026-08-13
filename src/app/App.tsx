import { useEffect, useState, type PointerEvent } from 'react'
import { useApp } from './AppContext'
import { Sidebar } from '../components/Sidebar'
import { SecuritiesView } from '../components/SecuritiesView'
import { TaxonomyView } from '../components/TaxonomyView'
import { SecurityDetailView } from '../components/SecurityDetailView'
import { SecurityForm, TaxonomyForm, WatchlistForm } from '../components/Forms'

type Dialog = 'security'|'watchlist'|'taxonomy'|null
export function App(){
  const app=useApp();const[dialog,setDialog]=useState<Dialog>(null);const[sidebarWidth,setSidebarWidth]=useState(()=>Number(localStorage.getItem('equity-journal.sidebar-width'))||196)
  useEffect(()=>{localStorage.setItem('equity-journal.sidebar-width',String(sidebarWidth))},[sidebarWidth])
  useEffect(()=>{
    if(!('__TAURI_INTERNALS__' in window))return
    let unlisten:(()=>void)|undefined
    import('@tauri-apps/api/event').then(({listen})=>listen<string>('theme-requested',(event)=>app.setTheme(event.payload as 'dark'|'light'|'system'))).then((result)=>{unlisten=result})
    return()=>unlisten?.()
  },[app.setTheme])
  useEffect(()=>{if('__TAURI_INTERNALS__' in window)import('@tauri-apps/api/core').then(({invoke})=>invoke('set_theme_menu',{mode:app.theme}))},[app.theme])
  const resize=(event:PointerEvent)=>{const startX=event.clientX,startWidth=sidebarWidth;event.currentTarget.setPointerCapture(event.pointerId);const move=(e:globalThis.PointerEvent)=>setSidebarWidth(Math.min(480,Math.max(210,startWidth+e.clientX-startX)));const end=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',end)};addEventListener('pointermove',move);addEventListener('pointerup',end)}
  if(app.error)return <div className="fatal-error"><h1>EquityJournal could not start</h1><p>{app.error}</p></div>
  if(!app.ready)return <div className="loading-screen"><div className="spinner"/>Loading EquityJournal…</div>
  return <div className="app-shell">
    <div className="workspace"><div className="sidebar-wrap" style={{width:sidebarWidth}}><Sidebar onNewSecurity={()=>setDialog('security')} onNewWatchlist={()=>setDialog('watchlist')} onNewTaxonomy={()=>setDialog('taxonomy')}/></div><div className="resize-handle" onPointerDown={resize}/><div className="view-container">{app.view.type==='all-securities'?<SecuritiesView/>:app.view.type==='watchlist'?<SecuritiesView watchlistId={app.view.id}/>:app.view.type==='taxonomy'?<TaxonomyView id={app.view.id}/>:<SecurityDetailView id={app.view.id}/>}</div></div>
    {dialog==='security'&&<SecurityForm onClose={()=>setDialog(null)}/>} {dialog==='watchlist'&&<WatchlistForm onClose={()=>setDialog(null)}/>} {dialog==='taxonomy'&&<TaxonomyForm onClose={()=>setDialog(null)}/>} 
  </div>
}
