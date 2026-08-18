import { buildTagTree, type Security, type Tag, type TaggedSecurity, type TagNode } from '../domain/types'

export type TaxonomyTreeModelNode =
  | { kind: 'tag'; id: string; tag: Tag; children: TaxonomyTreeModelNode[] }
  | { kind: 'security'; id: string; security: Security; tagId: string }

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
