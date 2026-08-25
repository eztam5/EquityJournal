export const TAXONOMY_TREE_CHANGED_EVENT='equity-journal:taxonomy-tree-changed'

export function notifyTaxonomyTreeChanged(taxonomyId:string) {
  window.dispatchEvent(new CustomEvent(TAXONOMY_TREE_CHANGED_EVENT,{detail:taxonomyId}))
}
