import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog navigation',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('opens on General and navigates to Database Connection',()=>{
    render(<AppProvider repository={new LocalRepository()}><SettingsDialog isOpen onClose={vi.fn()}/></AppProvider>)

    const navigation=screen.getByRole('navigation',{name:'Settings sections'})
    expect(within(navigation).getAllByRole('button').map((button)=>button.textContent)).toEqual(['General','Documents','Security Links','Database Connection'])
    expect(screen.getByRole('heading',{name:'General'})).toBeInTheDocument()
    expect(screen.queryByLabelText('Database Path')).not.toBeInTheDocument()

    fireEvent.click(within(navigation).getByRole('button',{name:'Database Connection'}))
    expect(screen.getByRole('heading',{name:'Database Connection'})).toBeInTheDocument()
    expect(screen.getByLabelText('Database Path')).toBeInTheDocument()
  })

  it('shows document storage settings separately',()=>{
    render(<AppProvider repository={new LocalRepository()}><SettingsDialog isOpen onClose={vi.fn()}/></AppProvider>)
    fireEvent.click(screen.getByRole('button',{name:'Documents'}))
    expect(screen.getByRole('heading',{name:'Documents'})).toBeInTheDocument()
    expect(screen.getByLabelText('Document folder')).toBeDisabled()
    expect(screen.getByText('Browser development mode stores attachments in IndexedDB.')).toBeInTheDocument()
  })

  it('configures global security links',async()=>{
    const repository=new LocalRepository();await repository.initialize();const onClose=vi.fn()
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={onClose}/></AppProvider>)
    fireEvent.click(screen.getByRole('button',{name:'Security Links'}))
    fireEvent.click(screen.getByRole('button',{name:'Add link'}))
    fireEvent.change(screen.getByLabelText('Link text'),{target:{value:'Yahoo Finance'}})
    fireEvent.change(screen.getByLabelText('URL pattern'),{target:{value:'https://finance.yahoo.com/quote/{SYMBOL}'}})
    fireEvent.click(screen.getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(onClose).toHaveBeenCalled())
    expect(await repository.listSecurityLinkTemplates()).toEqual([expect.objectContaining({linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0})])
  })

  it('persists the security-name display mode from General settings',async()=>{
    const repository=new LocalRepository();await repository.initialize();const onClose=vi.fn()
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={onClose}/></AppProvider>)

    fireEvent.change(screen.getByLabelText('Security names'),{target:{value:'name-only'}})
    fireEvent.click(screen.getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(onClose).toHaveBeenCalled())
    await waitFor(()=>expect(localStorage.getItem('equity-journal.security-display-mode')).toBe('name-only'))
  })
})
