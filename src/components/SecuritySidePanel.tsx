import { Button } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security } from '../domain/types'
import { resolveSecurityLink } from '../data/repository'
import { openExternalUrl } from '../utils/externalLinks'
import { SecurityLinkIcon } from './SecurityLinkIcon'
import { SecurityMetadata } from './SecurityMetadata'

export function SecuritySidePanel({ security, id, collapsed, onToggle }: { security: Security; id: string; collapsed: boolean; onToggle(): void }) {
  const app = useApp()
  const links = app.securityLinkTemplates.flatMap((template) => {
    const url = resolveSecurityLink(template, security)
    return url ? [{ ...template, url }] : []
  })

  return <aside id={id} className="security-side-panel" aria-label="Security details">
    <header className="security-side-panel-header">
      {!collapsed && <h2>Details</h2>}
      <Button variant="minimal" size="small" icon={collapsed ? 'chevron-left' : 'chevron-right'} aria-label={collapsed ? 'Show security details' : 'Collapse security details'} title={collapsed ? 'Show security details' : 'Collapse security details'} aria-expanded={!collapsed} aria-controls={`${id}-content`} onClick={onToggle}/>
    </header>
    <div id={`${id}-content`} hidden={collapsed}>
    <dl className="security-side-panel-facts">
      <div><dt>Alternative ID</dt><dd>{security.alternativeId || '—'}</dd></div>
      <div><dt>Currency</dt><dd>{security.currency}</dd></div>
    </dl>
    <section className="security-links" aria-labelledby="security-links-label">
      <h2 id="security-links-label">Links</h2>
      {links.length ? <div>{links.map((link) =>
        <Button key={link.id} variant="minimal" size="small" icon={<SecurityLinkIcon path={link.faviconPath}/>} text={link.linkText} title={link.url} onClick={() => openExternalUrl(link.url)}/>
      )}</div> : <span className="muted">No links configured</span>}
    </section>
    <SecurityMetadata key={security.id} securityId={security.id}/>
    </div>
  </aside>
}
