import { Menu, MenuItem, showContextMenu } from '@blueprintjs/core'
import type { MouseEvent } from 'react'
import type { Tag } from '../domain/types'

function menuPosition(event: MouseEvent) {
  event.preventDefault()
  return {
    targetOffset: { left: event.clientX, top: event.clientY },
    isDarkTheme: document.documentElement.classList.contains('bp6-dark'),
  }
}

export function showTaxonomyTagMenu(event: MouseEvent, tag: Tag | undefined, actions: {
  add(parent?: Tag): void
  editTaxonomy(): void
  edit(tag: Tag): void
  delete(tag: Tag): void
}) {
  showContextMenu({
    ...menuPosition(event),
    content: <Menu>
      <MenuItem icon="add" text="Add Tag" onClick={() => actions.add(tag)}/>
      {tag?<><MenuItem icon="edit" text="Edit Tag" onClick={() => actions.edit(tag)}/><MenuItem icon="trash" intent="danger" text="Delete Tag" onClick={() => actions.delete(tag)}/></>:<MenuItem icon="edit" text="Edit taxonomy" onClick={actions.editTaxonomy}/>}
    </Menu>,
  })
}

export function showTaxonomySecurityMenu(event: MouseEvent, securityId: string, tagId: string, remove: (securityId: string, tagId: string) => void) {
  showContextMenu({
    ...menuPosition(event),
    content: <Menu><MenuItem icon="remove" text="Remove from this tag" onClick={() => remove(securityId, tagId)}/></Menu>,
  })
}
