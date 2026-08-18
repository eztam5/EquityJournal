import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecurityDetailView } from './SecurityDetailView'

describe('SecurityDetailView research notes',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('loads the note belonging to each security when navigating between them',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const microsoft=await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    await repository.saveNote(apple.id,'<p>Apple thesis</p>')
    await repository.saveNote(microsoft.id,'<p>Microsoft thesis</p>')

    const view=render(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={microsoft.id}/></AppProvider>)
    expect(await screen.findByText('Microsoft thesis')).toBeInTheDocument()
    expect(screen.queryByText('Apple thesis')).not.toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()
    expect(screen.queryByText('Microsoft thesis')).not.toBeInTheDocument()
  })
})
