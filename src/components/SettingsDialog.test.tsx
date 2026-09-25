import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { uploadSecurityLinkFavicon } from '../utils/securityLinkFavicons'
import { SettingsDialog } from './SettingsDialog'

vi.mock('../utils/securityLinkFavicons',async(importOriginal)=>({...await importOriginal<typeof import('../utils/securityLinkFavicons')>(),fetchSecurityLinkFavicon:vi.fn(async()=> 'favicons/test.ico'),uploadSecurityLinkFavicon:vi.fn()}))

describe('SettingsDialog navigation',()=>{
  afterEach(()=>{cleanup();localStorage.clear();vi.mocked(uploadSecurityLinkFavicon).mockReset()})

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
    expect(screen.getByLabelText('Attachment folder')).toBeDisabled()
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
    expect(await repository.listSecurityLinkTemplates()).toEqual([expect.objectContaining({linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0,faviconPath:'favicons/test.ico'})])
  })

  it('saves a manually uploaded icon instead of fetching another one',async()=>{
    const repository=new LocalRepository();await repository.initialize();const onClose=vi.fn()
    await repository.saveSecurityLinkTemplates([{id:'roic',linkText:'ROIC',urlPattern:'https://www.roic.ai/quote/{SYMBOL}',sortOrder:0}])
    vi.mocked(uploadSecurityLinkFavicon).mockResolvedValue('favicons/manual.png')
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={onClose}/></AppProvider>)
    fireEvent.click(screen.getByRole('button',{name:'Security Links'}))
    fireEvent.click(await screen.findByRole('button',{name:'Upload icon for ROIC'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Save'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Save'}))
    await waitFor(()=>expect(onClose).toHaveBeenCalled())
    expect((await repository.listSecurityLinkTemplates())[0].faviconPath).toBe('favicons/manual.png')
  })

  it('shows upload errors and preserves the existing icon',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.saveSecurityLinkTemplates([{id:'roic',linkText:'ROIC',urlPattern:'https://www.roic.ai/quote/{SYMBOL}',sortOrder:0,faviconPath:'favicons/existing.ico'}])
    vi.mocked(uploadSecurityLinkFavicon).mockRejectedValue(new Error('Icons must be 1 MB or smaller.'))
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={vi.fn()}/></AppProvider>)
    fireEvent.click(screen.getByRole('button',{name:'Security Links'}))
    fireEvent.click(await screen.findByRole('button',{name:'Upload icon for ROIC'}))
    expect(await screen.findByText('Icons must be 1 MB or smaller.')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Save'})).toBeEnabled()
    expect((await repository.listSecurityLinkTemplates())[0].faviconPath).toBe('favicons/existing.ico')
  })

  it('persists the security-name display mode from General settings',async()=>{
    const repository=new LocalRepository();await repository.initialize();const onClose=vi.fn()
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={onClose}/></AppProvider>)

    fireEvent.change(screen.getByLabelText('Security names'),{target:{value:'name-only'}})
    fireEvent.click(screen.getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(onClose).toHaveBeenCalled())
    await waitFor(()=>expect(localStorage.getItem('equity-journal.security-display-mode')).toBe('name-only'))
  })

  it('persists the price update interval from General settings',async()=>{
    const repository=new LocalRepository();await repository.initialize();const onClose=vi.fn()
    render(<AppProvider repository={repository}><SettingsDialog isOpen onClose={onClose}/></AppProvider>)

    expect(screen.getByLabelText('Price update interval (minutes)')).toHaveValue('15')
    fireEvent.change(screen.getByLabelText('Price update interval (minutes)'),{target:{value:'30'}})
    fireEvent.click(screen.getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(onClose).toHaveBeenCalled())
    await waitFor(()=>expect(localStorage.getItem('equity-journal.price-update-interval-minutes')).toBe('30'))
  })
})
