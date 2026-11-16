import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Tag as BlueprintTag } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { SecurityResearchTopic, Tag } from '../domain/types'
import { TagAssignmentDialog } from './TagAssignmentDialog'

const VISIBLE_ITEMS = 3

function tagPath(tag: Tag, tags: Tag[]) {
  const byId = new Map(tags.filter((item) => item.taxonomyId === tag.taxonomyId).map((item) => [item.id, item]))
  const names: string[] = [], visited = new Set<string>()
  let current: Tag | undefined = tag
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return names.join(' ▸ ')
}

export function SecurityMetadata({ securityId }: { securityId: string }) {
  const app = useApp()
  const [tags, setTags] = useState<Tag[]>([])
  const [assigned, setAssigned] = useState<string[]>([])
  const [topics, setTopics] = useState<SecurityResearchTopic[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [showAllTopics, setShowAllTopics] = useState(false)
  const loadRequest = useRef(0)

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    setError('')
    try {
      const [groups, nextAssigned, nextTopics] = await Promise.all([
        Promise.all(app.taxonomies.map((taxonomy) => app.repository.listTags(taxonomy.id))),
        app.repository.assignedTagIds(securityId),
        app.repository.listSecurityResearchTopics(securityId),
      ])
      if (request !== loadRequest.current) return
      setTags(groups.flat())
      setAssigned(nextAssigned)
      setTopics(nextTopics)
      setLoaded(true)
    } catch (reason) {
      if (request === loadRequest.current) setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [app.repository, app.taxonomies, securityId])

  useEffect(() => {
    void load()
    return () => { loadRequest.current++ }
  }, [load, app.researchTopics])

  const classifications = useMemo(() => app.taxonomies.flatMap((taxonomy) =>
    tags.filter((tag) => tag.taxonomyId === taxonomy.id && assigned.includes(tag.id))
      .map((tag) => ({ tag, label: `${taxonomy.name}: ${tagPath(tag, tags)}` }))), [app.taxonomies, assigned, tags])

  const emptyText = (text: string) => !loaded ? error ? 'Unavailable' : 'Loading…' : text
  return <>
    <section className="security-context" aria-label="Security context">
      <section className="security-context-row" aria-labelledby="security-classifications-label">
        <h2 id="security-classifications-label">Classifications</h2>
        <div className="security-context-items" id="security-classifications">
          {classifications.length ? (showAllTags ? classifications : classifications.slice(0, VISIBLE_ITEMS)).map(({ tag, label }) =>
            <BlueprintTag className="security-classification-tag" round minimal multiline htmlTitle={label} style={{ borderColor: tag.color }} key={tag.id}>{label}</BlueprintTag>) :
            <span className="muted">{emptyText('No tags assigned')}</span>}
          {classifications.length > VISIBLE_ITEMS && <Button variant="minimal" size="small" className="security-context-more" aria-label={showAllTags ? 'Show fewer classifications' : `Show ${classifications.length - VISIBLE_ITEMS} more classifications`} aria-expanded={showAllTags} aria-controls="security-classifications" text={showAllTags ? 'Show less' : `+${classifications.length - VISIBLE_ITEMS} more`} onClick={() => setShowAllTags(!showAllTags)}/>}
        </div>
        <Button className="security-context-edit" variant="minimal" size="small" icon={classifications.length ? 'edit' : 'add'} text={classifications.length ? 'Edit tags' : 'Add tags'} aria-label="Edit classifications" onClick={() => setAssigning(true)}/>
      </section>
      <section className="security-context-row security-topics-row" aria-labelledby="security-topics-label">
        <h2 id="security-topics-label">Research topics</h2>
        <div className="security-context-items" id="security-topics">
          {topics.length ? (showAllTopics ? topics : topics.slice(0, VISIBLE_ITEMS)).map((topic) =>
            <Button key={topic.id} className="security-topic-link" variant="minimal" size="small" intent="primary" text={topic.title} title={topic.title} onClick={() => app.openResearchTopic(topic.id)}/>
          ) : <span className="muted">{emptyText('No related topics')}</span>}
          {topics.length > VISIBLE_ITEMS && <Button variant="minimal" size="small" className="security-context-more" aria-label={showAllTopics ? 'Show fewer research topics' : `Show ${topics.length - VISIBLE_ITEMS} more research topics`} aria-expanded={showAllTopics} aria-controls="security-topics" text={showAllTopics ? 'Show less' : `+${topics.length - VISIBLE_ITEMS} more`} onClick={() => setShowAllTopics(!showAllTopics)}/>}
        </div>
      </section>
      {error && <div className="security-context-error" role="alert"><span>Could not load security context: {error}</span><Button text="Retry" variant="minimal" size="small" onClick={() => void load()}/></div>}
    </section>
    {assigning && createPortal(<TagAssignmentDialog securityId={securityId} onClose={() => setAssigning(false)} onSaved={() => void load()}/>, document.body)}
  </>
}
