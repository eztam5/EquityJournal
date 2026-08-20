import type { ReactNode } from 'react'
import { Button } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'

export function PageToolbar({children,label='Page tools'}:{children:ReactNode;label?:string}) {
  return <div className="page-toolbar" role="toolbar" aria-label={label}>{children}</div>
}

export function PageHeader({title,description,actions,className=''}:{title:ReactNode;description?:ReactNode;actions?:ReactNode;className?:string}) {
  const app=useApp()
  return <header className={`page-header ${className}`.trim()}><div className="page-header-leading"><Button className="page-back-button" variant="minimal" icon="arrow-left" aria-label="Back" title="Back" disabled={!app.canGoBack} onClick={app.goBack}/><div className="page-heading"><h1>{title}</h1>{description&&<p>{description}</p>}</div></div>{actions&&<PageToolbar>{actions}</PageToolbar>}</header>
}
