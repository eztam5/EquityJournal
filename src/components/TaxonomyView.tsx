import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Callout, Tree, type TreeNodeInfo } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Tag, TaggedSecurity } from '../domain/types'
import { ConfirmDialog, TagForm } from './Forms'
import { showTaxonomySecurityMenu, showTaxonomyTagMenu } from './taxonomyContextMenus'
import { buildTaxonomyTreeModel, type TaxonomyTreeModelNode } from './taxonomyTreeModel'
import { useTaxonomyDragAndDrop, type TaxonomyDropOperation } from './useTaxonomyDragAndDrop'

export function TaxonomyView({ id }: { id: string }) {
  const app = useApp()
  const taxonomy = app.taxonomies.find((item) => item.id === id)
  const [tags, setTags] = useState<Tag[]>([])
  const [taggedSecurities, setTaggedSecurities] = useState<TaggedSecurity[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']))
  const [form, setForm] = useState<{ parent?: Tag; tag?: Tag } | null>(null)
  const [deleting, setDeleting] = useState<Tag>()
  const [assignmentError, setAssignmentError] = useState('')

  const load = useCallback(async () => {
    const [nextTags, nextSecurities] = await Promise.all([
      app.repository.listTags(id),
      app.repository.listTaggedSecurities(id),
    ])
    setTags(nextTags)
    setTaggedSecurities(nextSecurities)
  }, [app.repository, id])

  useEffect(() => { void load() }, [load])

  const placeSecurity = useCallback(async (operation: TaxonomyDropOperation) => {
    setAssignmentError('')
    try {
      if (operation.copy) await app.repository.copySecurityTag(operation.securityId, operation.toTagId)
      else await app.repository.moveSecurityTag(operation.securityId, operation.fromTagId, operation.toTagId)
      setExpanded((current) => new Set(current).add(operation.toTagId))
      await load()
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [app.repository, load])

  const drag = useTaxonomyDragAndDrop(placeSecurity)
  const model = useMemo(() => buildTaxonomyTreeModel(tags, taggedSecurities), [tags, taggedSecurities])

  if (!taxonomy) return <main className="content page"><div className="empty-state">Taxonomy not found.</div></main>

  const toggle = (value: string) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })

  const removeAssignment = async (securityId: string, tagId: string) => {
    setAssignmentError('')
    try {
      await app.repository.removeSecurityTag(securityId, tagId)
      await load()
    } catch (reason) {
      setAssignmentError(reason instanceof Error ? reason.message : String(reason))
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
      >{node.security.symbol} — {node.security.name}</span>,
      secondaryLabel: node.security.currency,
      icon: 'briefcase',
    }
    return {
      id: node.id,
      nodeData: node,
      label: <span
        data-taxonomy-tag-id={node.id}
        className={`taxonomy-node-label ${drag.dropTargetId === node.id ? `drop-target ${drag.copying ? 'copy-target' : ''}` : ''}`}
      ><i style={{ background: node.tag.color }}/>{node.tag.name}</span>,
      isExpanded: expanded.has(node.id),
      hasCaret: node.children.length > 0,
      childNodes: node.children.map(convert),
    }
  }

  const contents: TreeNodeInfo<TaxonomyTreeModelNode | undefined>[] = [{
    id: 'root',
    nodeData: undefined,
    label: <span className="taxonomy-node-label"><i style={{ background: taxonomy.color }}/>{taxonomy.name}</span>,
    icon: 'diagram-tree',
    isExpanded: expanded.has('root'),
    hasCaret: true,
    isSelected: true,
    childNodes: model.map(convert),
  }]

  return <main className="content page">
    <header className="page-header"><div><h1>{taxonomy.name}</h1><p>{taxonomy.description || 'Build a hierarchical classification for your research.'}</p></div></header>
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
    </div>
    {assignmentError && <Callout className="taxonomy-move-error" intent="danger">Could not update security assignment: {assignmentError}</Callout>}
    {form && <TagForm taxonomy={taxonomy} parent={form.parent} tag={form.tag} onSaved={load} onClose={() => setForm(null)}/>}
    {deleting && <ConfirmDialog title="Delete tag" message={`Do you really want to delete ${deleting.name}?`} onClose={() => setDeleting(undefined)} onConfirm={async () => { await app.repository.deleteTag(id, deleting.id); await load() }}/>}
  </main>
}
