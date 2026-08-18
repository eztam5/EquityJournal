export function allowsNativeContextMenu(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable]:not([contenteditable="false"]), [data-native-context-menu]'))
}

export function installContextMenuPolicy(documentRoot: Document = document) {
  const suppressNonEditableMenu = (event: MouseEvent) => {
    if (!allowsNativeContextMenu(event.target)) event.preventDefault()
  }
  documentRoot.addEventListener('contextmenu', suppressNonEditableMenu)
  return () => documentRoot.removeEventListener('contextmenu', suppressNonEditableMenu)
}
