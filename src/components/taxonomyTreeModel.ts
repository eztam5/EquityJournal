import { buildTagTree, type Security, type Tag, type TaggedSecurity, type TagNode } from '../domain/types'

export type TaxonomyTreeModelNode =
  | { kind: 'tag'; id: string; tag: Tag; children: TaxonomyTreeModelNode[] }
  | { kind: 'security'; id: string; security: Security; tagId: string }

export type TagDropPosition = 'before' | 'inside' | 'after' | 'root'

export function resolveTagDrop(tags: Tag[], tagId: string, targetTagId: string | null, position: TagDropPosition) {
  const tag = tags.find((item) => item.id === tagId)
  const target = targetTagId ? tags.find((item) => item.id === targetTagId) : undefined
  if (!tag || (targetTagId && !target) || targetTagId === tagId) return null
  if (target && target.taxonomyId !== tag.taxonomyId) return null

  const descendants = new Set<string>()
  const visit = (parentId: string) => tags.filter((item) => item.parentId === parentId).forEach((item) => { descendants.add(item.id); visit(item.id) })
  visit(tagId)
  if (targetTagId && descendants.has(targetTagId)) return null

  const parentId = position === 'inside' ? targetTagId : position === 'root' ? null : target?.parentId ?? null
  if (parentId && descendants.has(parentId)) return null
  const siblings = tags
    .filter((item) => item.id !== tagId && item.taxonomyId === tag.taxonomyId && item.parentId === parentId)
    .toSorted((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  if (position === 'before' || position === 'after') {
    const targetIndex = siblings.findIndex((item) => item.id === targetTagId)
    if (targetIndex < 0) return null
    return { parentId, index: targetIndex + (position === 'after' ? 1 : 0) }
  }
  return { parentId, index: siblings.length }
}

export function buildTaxonomyTreeModel(tags: Tag[], taggedSecurities: TaggedSecurity[]): TaxonomyTreeModelNode[] {
  const securitiesByTag = new Map<string, TaggedSecurity[]>()
  for (const security of taggedSecurities) {
    const assignments = securitiesByTag.get(security.tagId)
    if (assignments) assignments.push(security)
    else securitiesByTag.set(security.tagId, [security])
  }
  for (const assignments of securitiesByTag.values()) {
    assignments.sort((left, right) => left.symbol.localeCompare(right.symbol) || left.id.localeCompare(right.id))
  }

  const convert = (node: TagNode): TaxonomyTreeModelNode => ({
    kind: 'tag',
    id: node.id,
    tag: node,
    children: [
      ...node.children.map(convert),
      ...(securitiesByTag.get(node.id) ?? []).map((security) => ({
        kind: 'security' as const,
        id: `security:${node.id}:${security.id}`,
        security,
        tagId: node.id,
      })),
    ],
  })

  return buildTagTree(tags).map(convert)
}
