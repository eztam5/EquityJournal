import { afterEach, describe, expect, it, vi } from 'vitest'
import { installContextMenuPolicy } from './contextMenuPolicy'

describe('context menu policy',()=>{
  let uninstall:(()=>void)|undefined
  afterEach(()=>{uninstall?.();document.body.replaceChildren()})

  const contextMenu=(target:Element)=>{
    const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true})
    target.dispatchEvent(event)
    return event
  }

  it('suppresses the native menu on application chrome without blocking custom handlers',()=>{
    const label=document.createElement('span'),handler=vi.fn()
    label.addEventListener('contextmenu',handler);document.body.append(label)
    uninstall=installContextMenuPolicy()

    const event=contextMenu(label)

    expect(event.defaultPrevented).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('preserves native editing menus for inputs and rich-text content',()=>{
    const input=document.createElement('input')
    const editor=document.createElement('div');editor.setAttribute('contenteditable','true')
    const editorChild=document.createElement('span');editor.append(editorChild)
    document.body.append(input,editor)
    uninstall=installContextMenuPolicy()

    expect(contextMenu(input).defaultPrevented).toBe(false)
    expect(contextMenu(editorChild).defaultPrevented).toBe(false)
  })
})
