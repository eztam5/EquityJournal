import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { RichTextEditor } from './RichTextEditor'

describe('RichTextEditor internal reference picker',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('searches and inserts a security reference from the toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const onChange=vi.fn()
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Research </p>" onChange={onChange}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Link to security or research topic'}))
    const search=await screen.findByRole('searchbox',{name:'Search internal references'})
    fireEvent.change(search,{target:{value:'Apple'}})
    fireEvent.click(await screen.findByRole('menuitem',{name:'AAPL — Apple Inc.'}))

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    const html=onChange.mock.calls.at(-1)?.[0] as string
    expect(html).toContain(`data-reference-id="${security.id}"`)
    expect(html).toContain('data-reference-type="security"')
  })

  it('opens the same reference picker when the user types @',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Company</p>" onChange={vi.fn()}/></AppProvider>)

    const editor=document.querySelector<HTMLElement>('.rich-editor')
    expect(editor).not.toBeNull()
    fireEvent.keyDown(editor!,{key:'@',code:'KeyG',altKey:true})

    expect(await screen.findByRole('searchbox',{name:'Search internal references'})).toBeInTheDocument()
  })

  it('toggles a block quote from the toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const onChange=vi.fn()
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Long-term perspective</p>" onChange={onChange}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Block quote'}))

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('<blockquote>')
  })

  it('formats text as a third-level heading',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const onChange=vi.fn()
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Supporting detail</p>" onChange={onChange}/></AppProvider>)

    fireEvent.change(await screen.findByRole('combobox',{name:'Paragraph style'}),{target:{value:'h3'}})

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('<h3>Supporting detail</h3>')
  })

  it('removes a pasted font family when applying a heading preset',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const onChange=vi.fn()
    render(<AppProvider repository={repository}><RichTextEditor content={'<p><span style="font-family: Comic Sans MS; color: rgb(194, 85, 85)">Pasted research</span></p>'} onChange={onChange}/></AppProvider>)
    const editor=document.querySelector<HTMLElement>('.rich-editor')!
    fireEvent.keyDown(editor,{key:'a',ctrlKey:true})

    fireEvent.change(await screen.findByRole('combobox',{name:'Paragraph style'}),{target:{value:'h2'}})

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    const html=onChange.mock.calls.at(-1)?.[0] as string
    expect(html).toContain('<h2>')
    expect(html).not.toContain('font-family')
    expect(html).toContain('color: rgb(194, 85, 85)')
  })

  it('removes a pasted font family when applying a block quote',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const onChange=vi.fn()
    render(<AppProvider repository={repository}><RichTextEditor content={'<p><span style="font-family: Georgia">Quoted research</span></p>'} onChange={onChange}/></AppProvider>)
    const editor=document.querySelector<HTMLElement>('.rich-editor')!
    fireEvent.keyDown(editor,{key:'a',ctrlKey:true})

    fireEvent.click(await screen.findByRole('button',{name:'Block quote'}))

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    const html=onChange.mock.calls.at(-1)?.[0] as string
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('font-family')
  })
})
