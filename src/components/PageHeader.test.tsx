import { fireEvent, render, screen, within } from '@testing-library/react'
import { Button, InputGroup } from '@blueprintjs/core'
import { describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { isPageSearchShortcut, PageHeader, PageToolbarIconBar, PageToolbarIconButton } from './PageHeader'

describe('PageHeader',()=>{
  it('groups multiple page actions in an accessible toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><PageHeader title="Example" description="Page description" actions={<><Button text="First"/><Button text="Second"/></>}/></AppProvider>)

    expect(screen.getByRole('heading',{name:'Example'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Back'})).toBeDisabled()
    const toolbar=screen.getByRole('toolbar',{name:'Page tools'})
    expect(within(toolbar).getAllByRole('button')).toHaveLength(2)
  })

  it('renders compact page actions as labelled icon-only buttons',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><PageHeader title="Example" actions={<PageToolbarIconBar><PageToolbarIconButton icon="export" label="Export"/></PageToolbarIconBar>}/></AppProvider>)

    const group=screen.getByRole('group',{name:'Page actions'})
    const button=within(group).getByRole('button',{name:'Export'})
    expect(button).toHaveClass('page-toolbar-icon-button')
    expect(button).toHaveTextContent('')
    fireEvent.mouseEnter(button)
    expect(screen.queryByText('Export',{selector:'.bp6-popover-content'})).not.toBeInTheDocument()
    expect(await screen.findByText('Export',{selector:'.bp6-popover-content'})).toBeInTheDocument()
  })

  it('focuses and selects the page search with the native find shortcut',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><PageHeader title="Example" actions={<InputGroup type="search" aria-label="Search example" defaultValue="quality"/>}/></AppProvider>)
    const search=screen.getByRole('searchbox',{name:'Search example'}) as HTMLInputElement
    search.setSelectionRange(search.value.length,search.value.length)
    const mac=/Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    const event=new KeyboardEvent('keydown',{key:'f',ctrlKey:!mac,metaKey:mac,bubbles:true,cancelable:true})

    dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(search).toHaveFocus()
    expect(search.selectionStart).toBe(0)
    expect(search.selectionEnd).toBe(search.value.length)
  })

  it('uses Command-F on macOS and Control-F elsewhere',()=>{
    const key=(modifiers:Partial<Pick<KeyboardEvent,'ctrlKey'|'metaKey'>>) => ({key:'f',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...modifiers})
    expect(isPageSearchShortcut(key({metaKey:true}),'MacIntel')).toBe(true)
    expect(isPageSearchShortcut(key({ctrlKey:true}),'MacIntel')).toBe(false)
    expect(isPageSearchShortcut(key({ctrlKey:true}),'Win32')).toBe(true)
    expect(isPageSearchShortcut(key({metaKey:true}),'Linux x86_64')).toBe(false)
  })
})
