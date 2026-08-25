import { useEffect, useRef, type ReactNode } from 'react'
import { Button, Tooltip, type ButtonProps } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'

export function PageToolbar({children,label='Page tools'}:{children:ReactNode;label?:string}) {
  return <div className="page-toolbar" role="toolbar" aria-label={label}>{children}</div>
}

export function PageToolbarIconBar({children,label='Page actions'}:{children:ReactNode;label?:string}) {
  return <div className="page-toolbar-icon-bar" role="group" aria-label={label}>{children}</div>
}

export function PageToolbarIconButton({label,className='',...props}:{label:string}&Omit<ButtonProps,'text'|'aria-label'>) {
  return <Tooltip content={label} placement="bottom" hoverOpenDelay={500}><Button {...props} className={`page-toolbar-icon-button ${className}`.trim()} variant={props.variant??'minimal'} aria-label={label}/></Tooltip>
}

export function isPageSearchShortcut(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>,platform=navigator.platform) {
  const mac=/Mac|iPhone|iPad|iPod/i.test(platform)
  return event.key.toLocaleLowerCase()==='f'&&!event.altKey&&!event.shiftKey&&(mac?event.metaKey&&!event.ctrlKey:event.ctrlKey&&!event.metaKey)
}

export function PageHeader({title,description,actions,className=''}:{title:ReactNode;description?:ReactNode;actions?:ReactNode;className?:string}) {
  const app=useApp()
  const header=useRef<HTMLElement>(null)
  useEffect(()=>{
    const focusSearch=(event:KeyboardEvent)=>{
      if(!isPageSearchShortcut(event))return
      const search=header.current?.querySelector<HTMLInputElement>('input[type="search"]')
      if(!search||search.disabled)return
      event.preventDefault()
      search.focus()
      search.select()
    }
    addEventListener('keydown',focusSearch)
    return()=>removeEventListener('keydown',focusSearch)
  },[])
  return <header ref={header} className={`page-header ${className}`.trim()}><div className="page-header-leading"><Button className="page-back-button" variant="minimal" icon="arrow-left" aria-label="Back" title="Back" disabled={!app.canGoBack} onClick={app.goBack}/><div className="page-heading"><h1>{title}</h1>{description&&<p>{description}</p>}</div></div>{actions&&<PageToolbar>{actions}</PageToolbar>}</header>
}
