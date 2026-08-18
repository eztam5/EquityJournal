import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Button, Callout, InputGroup, Tree, type TreeNodeInfo } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Tag, TaggedSecurity } from '../domain/types'
import { ConfirmDialog, TagForm } from './Forms'
import { showTaxonomySecurityMenu, showTaxonomyTagMenu } from './taxonomyContextMenus'
import { buildTaxonomyTreeModel, filterTaxonomyTreeModel, resolveTagDrop, type TaxonomyTreeModelNode } from './taxonomyTreeModel'
import { useTaxonomyDragAndDrop, type TaxonomyDropOperation } from './useTaxonomyDragAndDrop'
import { formatSecurityLabel } from '../utils/securityLabels'

export function TaxonomyView({ id }: { id: string }) {
  const app = useApp()
  const taxonomy = app.taxonomies.find((item) => item.id === id)
  const [tags, setTags] = useState<Tag[]>([])
  const [taggedSecurities, setTaggedSecurities] = useState<TaggedSecurity[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']))
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ parent?: Tag; tag?: Tag } | null>(null)
  const [deleting, setDeleting] = useState<Tag>()
  const [interactionError, setInteractionError] = useState('')

  const load = useCallback(async () => {
    const [nextTags, nextSecurities] = await Promise.all([
      app.repository.listTags(id),
      app.repository.listTaggedSecurities(id),
    ])
    setTags(nextTags)
    setTaggedSecurities(nextSecurities)
  }, [app.repository, id])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setSearch('') }, [id])

  const handleDrop = useCallback(async (operation: TaxonomyDropOperation) => {
    setInteractionError('')
    try {
      if (operation.kind === 'security') {
        if (operation.copy) await app.repository.copySecurityTag(operation.securityId, operation.toTagId)
        else await app.repository.moveSecurityTag(operation.securityId, operation.fromTagId, operation.toTagId)
        setExpanded((current) => new Set(current).add(operation.toTagId))
      } else {
        const destination = resolveTagDrop(tags, operation.tagId, operation.targetTagId, operation.position)
        if (!destination) return
        await app.repository.moveTag(operation.tagId, destination.parentId, destination.index)
        setExpanded((current) => {
          const next = new Set(current)
          next.add('root')
          if (destination.parentId) next.add(destination.parentId)
          return next
        })
      }
      await load()
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [app.repository, load, tags])

  const canDrop = useCallback((operation: TaxonomyDropOperation) => operation.kind === 'security'
    ? operation.fromTagId !== operation.toTagId
    : Boolean(resolveTagDrop(tags, operation.tagId, operation.targetTagId, operation.position)), [tags])
  const drag = useTaxonomyDragAndDrop({ onDrop: handleDrop, canDrop })
  const model = useMemo(() => filterTaxonomyTreeModel(buildTaxonomyTreeModel(tags, taggedSecurities), search), [search, tags, taggedSecurities])
  const searching = search.trim().length > 0

  if (!taxonomy) return <main className="content page"><div className="empty-state">Taxonomy not found.</div></main>

  const toggle = (value: string) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })

  const removeAssignment = async (securityId: string, tagId: string) => {
    setInteractionError('')
    try {
      await app.repository.removeSecurityTag(securityId, tagId)
      await load()
    } catch (reason) {
      setInteractionError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const openTagMenu = (event: MouseEvent, tag?: Tag) => showTaxonomyTagMenu(event, tag, {
    add: (parent) => {
      setForm({ parent })
      if (parent) setExpanded((current) => new Set(current).add(parent.id))
    },
    edit: (item) => setForm({ tag: item }),
    delete: setDeleting,
  })

  const convert = (node: TaxonomyTreeModelNode): TreeNodeInfo<TaxonomyTreeModelNode> => {
    if (node.kind === 'security') return {
      id: node.id,
      nodeData: node,
      label: <span
        className="taxonomy-security-label"
        data-security-id={node.security.id}
        data-tag-id={node.tagId}
        title="Drag to move; hold the copy modifier to copy"
      >{formatSecurityLabel(node.security,app.securityDisplayMode)}</span>,
      secondaryLabel: node.security.currency,
      icon: 'briefcase',
    }
    return {
      id: node.id,
      nodeData: node,
      label: <span
        data-taxonomy-tag-id={node.id}
        data-draggable-tag-id={node.id}
        className={`taxonomy-node-label ${drag.dropTarget?.tagId === node.id ? `drop-target ${drag.draggingKind === 'tag' ? `tag-drop-${drag.dropTarget.position}` : drag.copying ? 'copy-target' : ''}` : ''}`}
      ><i style={{ background: node.tag.color }}/>{node.tag.name}</span>,
      isExpanded: searching || expanded.has(node.id),
      hasCaret: node.children.length > 0,
      childNodes: node.children.map(convert),
    }
  }

  const contents: TreeNodeInfo<TaxonomyTreeModelNode | undefined>[] = [{
    id: 'root',
    nodeData: undefined,
    label: <span data-taxonomy-root-drop-target className={`taxonomy-node-label ${drag.draggingKind === 'tag' && drag.dropTarget?.position === 'root' ? 'drop-target tag-drop-root' : ''}`}><i style={{ background: taxonomy.color }}/>{taxonomy.name}</span>,
    icon: 'diagram-tree',
    isExpanded: searching || expanded.has('root'),
    hasCaret: model.length > 0,
    isSelected: true,
    childNodes: model.map(convert),
  }]

  return <main className="content page">
    <header className="page-header taxonomy-page-header"><div><h1>{taxonomy.name}</h1><p>{taxonomy.description || 'Build a hierarchical classification for your research.'}</p></div><InputGroup
      className="taxonomy-search"
      type="search"
      leftIcon="search"
      placeholder="Search tags or securities"
      aria-label="Search tags or securities"
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      rightElement={search ? <Button variant="minimal" icon="cross" aria-label="Clear search" onClick={() => setSearch('')}/> : undefined}
    /></header>
    <div className="content-panel taxonomy-card" {...drag.pointerHandlers}>
      <Tree
        compact
        contents={contents}
        onNodeExpand={(node) => toggle(String(node.id))}
        onNodeCollapse={(node) => toggle(String(node.id))}
        onNodeDoubleClick={(node) => { if (node.nodeData?.kind === 'security') app.openSecurity(node.nodeData.security.id) }}
        onNodeContextMenu={(node, _path, event) => {
          if (!node.nodeData) openTagMenu(event)
          else if (node.nodeData.kind === 'tag') openTagMenu(event, node.nodeData.tag)
          else showTaxonomySecurityMenu(event, node.nodeData.security.id, node.nodeData.tagId, (securityId, tagId) => { void removeAssignment(securityId, tagId) })
        }}
      />
      {searching && model.length === 0 && <div className="empty-state">No matching tags or securities.</div>}
    </div>
    {interactionError && <Callout className="taxonomy-move-error" intent="danger">Could not update taxonomy: {interactionError}</Callout>}
    {form && <TagForm taxonomy={taxonomy} parent={form.parent} tag={form.tag} onSaved={load} onClose={() => setForm(null)}/>}
    {deleting && <ConfirmDialog title="Delete tag" message={`Do you really want to delete ${deleting.name}?`} onClose={() => setDeleting(undefined)} onConfirm={async () => { await app.repository.deleteTag(id, deleting.id); await load() }}/>}
  </main>
}
