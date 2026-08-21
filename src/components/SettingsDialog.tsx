import { useState, useEffect } from 'react'
import { Button, Callout, Card, FormGroup, HTMLSelect, InputGroup, Dialog } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { SecurityLinkTemplate } from '../domain/types'
import type { SecurityDisplayMode } from '../utils/securityLabels'

interface DatabaseConfig {
  path: string
}

interface DocumentStorageConfig {
  path: string
}

type SettingsSection = 'general' | 'documents' | 'links' | 'database'

export function SettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const app = useApp()
  const [section, setSection] = useState<SettingsSection>('general')
  const [config, setConfig] = useState<DatabaseConfig>({ path: '' })
  const [defaultConfig, setDefaultConfig] = useState<DatabaseConfig | null>(null)
  const [documentConfig, setDocumentConfig] = useState<DocumentStorageConfig>({path:''})
  const [initialDocumentConfig, setInitialDocumentConfig] = useState<DocumentStorageConfig | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [linkTemplates, setLinkTemplates] = useState<SecurityLinkTemplate[]>([])
  const [securityDisplayMode, setSecurityDisplayMode] = useState<SecurityDisplayMode>(app.securityDisplayMode)
  const [settingsError, setSettingsError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSection('general'); setSettingsError(''); setSecurityDisplayMode(app.securityDisplayMode)
      app.repository.listSecurityLinkTemplates().then(setLinkTemplates).catch((reason) => setSettingsError(reason instanceof Error ? reason.message : String(reason)))
    }
    if (isOpen && '__TAURI_INTERNALS__' in window) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke<DatabaseConfig>('get_database_config').then(setDefaultConfig).then(() => {
          invoke<DatabaseConfig>('get_database_config').then(setConfig)
        })
        invoke<DocumentStorageConfig>('get_document_storage_config').then((next)=>{setDocumentConfig(next);setInitialDocumentConfig(next)}).catch((reason)=>setSettingsError(reason instanceof Error?reason.message:String(reason)))
      })
    }
  }, [app.repository, isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    setSettingsError('')
    try {
      await app.repository.saveSecurityLinkTemplates(linkTemplates.map((template, sortOrder) => ({ ...template, sortOrder })))
      await app.refresh()
      if (defaultConfig && config.path !== defaultConfig.path) {
        // Path changed, ask what to do
        const shouldCopy = confirm(
          `Database path changed from:\n${defaultConfig.path}\n\nto:\n${config.path}\n\nWould you like to copy the existing database to the new location?\n\n(Cancel will start with an empty database)`
        )
        if ('__TAURI_INTERNALS__' in window) {
          await import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke('change_database_path', { newPath: config.path, copyExisting: shouldCopy })
          )
        }
      } else if (defaultConfig) {
        if ('__TAURI_INTERNALS__' in window) {
          await import('@tauri-apps/api/core').then(({ invoke }) =>
            invoke('save_database_config', { config })
          )
        }
      }
      app.setSecurityDisplayMode(securityDisplayMode)
      if(initialDocumentConfig&&documentConfig.path.trim()!==initialDocumentConfig.path){
        await import('@tauri-apps/api/core').then(({invoke})=>invoke('change_document_storage_path',{newPath:documentConfig.path.trim()}))
      }
      onClose()
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSaving(false)
    }
  }

  const addLinkTemplate = () => setLinkTemplates((templates) => [...templates, { id: crypto.randomUUID(), linkText: '', urlPattern: '', sortOrder: templates.length }])
  const updateLinkTemplate = (id: string, field: 'linkText' | 'urlPattern', value: string) => setLinkTemplates((templates) => templates.map((template) => template.id === id ? { ...template, [field]: value } : template))
  const chooseDocumentFolder=async()=>{if(!('__TAURI_INTERNALS__' in window))return;const{open}=await import('@tauri-apps/plugin-dialog');const path=await open({title:'Choose document folder',directory:true,multiple:false,fileAccessMode:'scoped'});if(path)setDocumentConfig({path})}

  return (
    <Dialog className="settings-dialog" isOpen={isOpen} onClose={onClose} title="Settings" style={{ width: '840px' }}>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          <Button fill alignText="start" variant="minimal" icon="cog" text="General" active={section==='general'} onClick={()=>setSection('general')}/>
          <Button fill alignText="start" variant="minimal" icon="folder-open" text="Documents" active={section==='documents'} onClick={()=>setSection('documents')}/>
          <Button fill alignText="start" variant="minimal" icon="link" text="Security Links" active={section==='links'} onClick={()=>setSection('links')}/>
          <Button fill alignText="start" variant="minimal" icon="database" text="Database Connection" active={section==='database'} onClick={()=>setSection('database')}/>
        </nav>
        <div className="settings-main">
          <div className="settings-content">
            {section==='general'?<section aria-labelledby="general-settings-heading"><h2 id="general-settings-heading">General</h2><p className="muted">Configure how EquityJournal presents information throughout the application.</p><Card className="settings-card" elevation={0}><FormGroup label="Security names" helperText="Choose how security names are displayed throughout the application." labelFor="security-display-mode"><HTMLSelect id="security-display-mode" fill value={securityDisplayMode} onChange={(event)=>setSecurityDisplayMode(event.currentTarget.value as SecurityDisplayMode)} options={[{value:'symbol-first',label:'Symbol first — AAPL — Apple Inc.'},{value:'name-first',label:'Company name first — Apple Inc. — AAPL'},{value:'name-only',label:'Company name only — Apple Inc.'}]}/></FormGroup></Card></section>:section==='documents'?<section aria-labelledby="document-settings-heading"><h2 id="document-settings-heading">Documents</h2><p className="muted">Choose where managed PDF attachments are stored.</p><Card className="settings-card" elevation={0}><FormGroup label="Document folder" helperText="When this location changes, existing managed PDFs are moved to the new folder." labelFor="document-folder"><InputGroup id="document-folder" value={documentConfig.path} disabled={!('__TAURI_INTERNALS__' in window)} onChange={(event)=>setDocumentConfig({path:event.currentTarget.value})} placeholder="Choose a folder" rightElement={<Button icon="folder-open" text="Browse" disabled={!('__TAURI_INTERNALS__' in window)} onClick={()=>void chooseDocumentFolder()}/>} /></FormGroup>{!('__TAURI_INTERNALS__' in window)&&<Callout icon="info-sign">Browser development mode stores attachments in IndexedDB.</Callout>}</Card></section>:section==='links'?<section aria-labelledby="link-settings-heading"><div className="settings-section-heading"><div><h2 id="link-settings-heading">Security Links</h2><p className="muted">Create links to external research websites for every security.</p></div><Button icon="add" text="Add link" onClick={addLinkTemplate}/></div><Callout className="link-placeholder-help" icon="info-sign">Use <code>{'{SYMBOL}'}</code> and <code>{'{ALTERNATIVE_ID}'}</code> in URL patterns. Links requiring an empty Alternative ID are hidden.</Callout><div className="link-template-list">{linkTemplates.length===0?<div className="empty-state">No external links configured yet.</div>:linkTemplates.map((template, index)=><Card className="link-template-card" elevation={0} key={template.id}><div className="link-template-number">{index+1}</div><FormGroup label="Link text" labelFor={`link-text-${template.id}`}><InputGroup id={`link-text-${template.id}`} value={template.linkText} onChange={(event)=>updateLinkTemplate(template.id,'linkText',event.target.value)} placeholder="Yahoo Finance"/></FormGroup><FormGroup label="URL pattern" labelFor={`link-pattern-${template.id}`}><InputGroup id={`link-pattern-${template.id}`} value={template.urlPattern} onChange={(event)=>updateLinkTemplate(template.id,'urlPattern',event.target.value)} placeholder="https://finance.yahoo.com/quote/{SYMBOL}"/></FormGroup><Button minimal intent="danger" icon="trash" aria-label={`Remove link ${index+1}`} onClick={()=>setLinkTemplates((templates)=>templates.filter((item)=>item.id!==template.id))}/></Card>)}</div></section>:<section aria-labelledby="database-settings-heading"><h2 id="database-settings-heading">Database Connection</h2><p className="muted">Choose where EquityJournal stores its SQLite database.</p><Card className="settings-card" elevation={0}><FormGroup label="Database Path" labelFor="db-path"><InputGroup
              id="db-path"
              value={config.path}
              onChange={(e) => setConfig({ ...config, path: e.currentTarget.value })}
              placeholder={defaultConfig?.path || '/path/to/database.db'}
            /></FormGroup></Card></section>}
            {settingsError&&<Callout className="settings-error" intent="danger">{settingsError}</Callout>}
          </div>
          <div className="settings-actions">
            <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button intent="primary" onClick={handleSave} loading={isSaving}>Save</Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
