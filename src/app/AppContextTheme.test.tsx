import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalRepository } from '../data/localRepository'
import { AppProvider, useApp } from './AppContext'

function ThemeControls(){
  const app=useApp()
  return <button onClick={()=>app.setTheme('light')}>Use light theme</button>
}

afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()})

describe('system theme',()=>{
  it('follows live system changes and stops listening when a fixed theme is selected',()=>{
    localStorage.setItem('equity-journal.theme','system')
    const query=Object.assign(new EventTarget(),{matches:false})
    const remove=vi.spyOn(query,'removeEventListener')
    vi.stubGlobal('matchMedia',vi.fn(()=>query))
    render(<AppProvider repository={new LocalRepository()}><ThemeControls/></AppProvider>)
    expect(document.documentElement.dataset.theme).toBe('light')
    act(()=>{query.matches=true;query.dispatchEvent(new Event('change'))})
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.documentElement).toHaveClass('bp6-dark')
    act(()=>{query.matches=false;query.dispatchEvent(new Event('change'))})
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement).not.toHaveClass('bp6-dark')
    expect(localStorage.getItem('equity-journal.theme')).toBe('system')
    fireEvent.click(screen.getByRole('button',{name:'Use light theme'}))
    expect(remove).toHaveBeenCalledWith('change',expect.any(Function))
    act(()=>{query.matches=true;query.dispatchEvent(new Event('change'))})
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('removes the system listener on unmount',()=>{
    localStorage.setItem('equity-journal.theme','system')
    const query=Object.assign(new EventTarget(),{matches:true})
    const remove=vi.spyOn(query,'removeEventListener')
    vi.stubGlobal('matchMedia',vi.fn(()=>query))
    const view=render(<AppProvider repository={new LocalRepository()}><ThemeControls/></AppProvider>)
    view.unmount()
    expect(remove).toHaveBeenCalledWith('change',expect.any(Function))
  })
})
