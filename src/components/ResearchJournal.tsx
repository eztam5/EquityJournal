import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Button, Callout, InputGroup } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { SecurityJournalEntry } from '../domain/types'
import { ConfirmDialog } from './Forms'

const RichTextEditor = lazy(() => import('./RichTextEditor').then((module) => ({ default: module.RichTextEditor })))

interface DraftEntry {
  id?: string
  entryDate: string
  contentHtml: string
}

function today() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`))
}

function preview(html: string) {
  const element = document.createElement('div')
  element.innerHTML = html
  return element.textContent?.trim() || 'Empty entry'
}

export function ResearchJournal({ securityId }: { securityId: string }) {
  const app = useApp()
  const [entries, setEntries] = useState<SecurityJournalEntry[]>([])
  const [draft, setDraft] = useState<DraftEntry>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState<SecurityJournalEntry>()

  const load = useCallback(async (preferredId?: string) => {
    const next = await app.repository.listJournalEntries(securityId)
    setEntries(next)
    const selected = next.find((entry) => entry.id === preferredId) ?? next[0]
    setDraft(selected ? { id: selected.id, entryDate: selected.entryDate, contentHtml: selected.contentHtml } : undefined)
    setDirty(false)
    return next
  }, [app.repository, securityId])

  useEffect(() => {
    let active = true
    setLoading(true); setStatus(''); setEntries([]); setDraft(undefined); setDirty(false)
    app.repository.listJournalEntries(securityId).then((next) => {
      if (!active) return
      setEntries(next)
      const selected = next[0]
      if (selected) setDraft({ id: selected.id, entryDate: selected.entryDate, contentHtml: selected.contentHtml })
    }).catch((reason) => {
      if (active) setStatus(reason instanceof Error ? reason.message : String(reason))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [app.repository, securityId])

  const save = async () => {
    if (!draft) return
    setSaving(true); setStatus('')
    try {
      const saved = await app.repository.saveJournalEntry({ ...draft, securityId })
      await load(saved.id)
      setStatus('Saved')
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : String(reason))
    } finally { setSaving(false) }
  }

  const add = () => {
    const existing = entries.find((entry) => entry.entryDate === today())
    if (existing) {
      setDraft({ id: existing.id, entryDate: existing.entryDate, contentHtml: existing.contentHtml })
    } else setDraft({ entryDate: today(), contentHtml: '' })
    setDirty(false); setStatus(existing ? 'An entry for today already exists.' : '')
  }

  const select = (entry: SecurityJournalEntry) => {
    setDraft({ id: entry.id, entryDate: entry.entryDate, contentHtml: entry.contentHtml })
    setDirty(false); setStatus('')
  }

  if (loading) return <div className="empty-state">Loading journal…</div>

  return <div className="journal-workspace">
    <aside className="journal-timeline" aria-label="Journal entries">
      <Button icon="add" intent="primary" text="Add entry" onClick={add}/>
      {entries.length === 0 ? <p className="muted">No journal entries yet.</p> : entries.map((entry) => <Button key={entry.id} className={draft?.id === entry.id ? 'active' : ''} alignText="left" onClick={() => select(entry)}>
        <strong>{displayDate(entry.entryDate)}</strong>
        <span>{preview(entry.contentHtml)}</span>
      </Button>)}
    </aside>
    <section className="journal-editor">
      {!draft ? <div className="empty-state"><p>Record how your view of this company develops over time.</p><Button icon="add" intent="primary" text="Add first entry" onClick={add}/></div> : <>
        <header>
          <label htmlFor="journal-entry-date">Entry date</label>
          <InputGroup id="journal-entry-date" type="date" value={draft.entryDate} onChange={(event) => { setDraft({ ...draft, entryDate: event.target.value }); setDirty(true); setStatus('Unsaved changes') }}/>
          <span>{status || (dirty ? 'Unsaved changes' : '')}</span>
          {draft.id && <Button icon="trash" intent="danger" minimal aria-label="Delete journal entry" onClick={() => setDeleting(entries.find((entry) => entry.id === draft.id))}/>} 
          <Button icon="floppy-disk" intent="primary" text="Save" loading={saving} disabled={!draft.entryDate || !dirty && Boolean(draft.id)} onClick={save}/>
        </header>
        {status && status !== 'Saved' && status !== 'Unsaved changes' && status !== 'An entry for today already exists.' ? <Callout className="journal-error" intent="danger">{status}</Callout> : null}
        <Suspense fallback={<div className="empty-state">Loading editor…</div>}><RichTextEditor key={draft.id ?? `new-${draft.entryDate}`} content={draft.contentHtml} onChange={(contentHtml) => { setDraft((current) => current ? { ...current, contentHtml } : current); setDirty(true); setStatus('Unsaved changes') }}/></Suspense>
      </>}
    </section>
    {deleting && <ConfirmDialog title="Delete journal entry" message={`Delete the journal entry from ${displayDate(deleting.entryDate)}?`} confirmLabel="Delete" onClose={() => setDeleting(undefined)} onConfirm={async () => { await app.repository.deleteJournalEntry(deleting.id); await load() }}/>} 
  </div>
}
