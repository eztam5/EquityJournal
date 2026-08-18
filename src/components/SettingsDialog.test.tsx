import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog navigation',()=>{
  afterEach(cleanup)

  it('opens on General and navigates to Database Connection',()=>{
    render(<SettingsDialog isOpen onClose={vi.fn()}/>)

    const navigation=screen.getByRole('navigation',{name:'Settings sections'})
    expect(within(navigation).getAllByRole('button').map((button)=>button.textContent)).toEqual(['General','Database Connection'])
    expect(screen.getByRole('heading',{name:'General'})).toBeInTheDocument()
    expect(screen.queryByLabelText('Database Path')).not.toBeInTheDocument()

    fireEvent.click(within(navigation).getByRole('button',{name:'Database Connection'}))
    expect(screen.getByRole('heading',{name:'Database Connection'})).toBeInTheDocument()
    expect(screen.getByLabelText('Database Path')).toBeInTheDocument()
  })
})
