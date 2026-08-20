import { render, screen, within } from '@testing-library/react'
import { Button } from '@blueprintjs/core'
import { describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { PageHeader } from './PageHeader'

describe('PageHeader',()=>{
  it('groups multiple page actions in an accessible toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><PageHeader title="Example" description="Page description" actions={<><Button text="First"/><Button text="Second"/></>}/></AppProvider>)

    expect(screen.getByRole('heading',{name:'Example'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Back'})).toBeDisabled()
    const toolbar=screen.getByRole('toolbar',{name:'Page tools'})
    expect(within(toolbar).getAllByRole('button')).toHaveLength(2)
  })
})
