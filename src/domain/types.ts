export type ThemeMode = 'dark' | 'light' | 'system'

export interface Security {
  id: string
  name: string
  symbol: string
  currency: string
}

export interface Watchlist {
  id: string
  name: string
}

export interface Taxonomy {
  id: string
  name: string
  description: string
  color: string
  sortOrder: number
}

export interface Tag {
  id: string
  taxonomyId: string
  parentId: string | null
  name: string
  description: string
  color: string
  sortOrder: number
}

export interface TagNode extends Tag {
  children: TagNode[]
}

export interface SecurityNote {
  securityId: string
  contentHtml: string
  updatedAt: string
}

export type View =
  | { type: 'all-securities' }
  | { type: 'watchlist'; id: string }
  | { type: 'taxonomy'; id: string }
  | { type: 'security'; id: string }

export function buildTagTree(tags: Tag[]): TagNode[] {
  const nodes = new Map(tags.map((tag) => [tag.id, { ...tag, children: [] as TagNode[] }]))
  const roots: TagNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (items: TagNode[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    items.forEach((item) => sort(item.children))
  }
  sort(roots)
  return roots
}
