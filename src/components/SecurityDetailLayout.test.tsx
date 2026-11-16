import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import type { Security } from '../domain/types'
import { SecurityDetailLayout } from './SecurityDetailLayout'

const PREFERENCES_KEY = 'equity-journal.security-details-panel.v1'
const security: Security = { id: 'example', symbol: 'EX', name: 'Example company', alternativeId: 'US1234567890', currency: 'USD' }

function measureLayout(initialWidth: number) {
  let width = initialWidth
  const original = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('security-research-layout') ? { x: 0, y: 0, top: 0, left: 0, right: width, bottom: 800, width, height: 800, toJSON() { return {} } } : original.call(this)
  })
  return (nextWidth: number) => { width = nextWidth; fireEvent(window, new Event('resize')) }
}

function renderLayout(repository = new LocalRepository()) {
  return render(<AppProvider repository={repository}><SecurityDetailLayout security={security}><p>Chart and research workspace</p></SecurityDetailLayout></AppProvider>)
}

function pointer(element: HTMLElement, type: string, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  fireEvent(element, event)
}

describe('Security detail panel controls', () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

  it('collapses to a restore control, keeps the workspace visible, and remembers the choice', () => {
    measureLayout(1200)
    const repository = new LocalRepository()
    const view = renderLayout(repository)
    const value = screen.getByText('US1234567890')
    expect(value).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse security details' }))
    expect(value).not.toBeVisible()
    expect(screen.getByText('Chart and research workspace')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Show security details' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('separator', { name: 'Resize security details' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({ width: 280, collapsed: true })

    view.unmount()
    renderLayout(repository)
    fireEvent.click(screen.getByRole('button', { name: 'Show security details' }))
    expect(screen.getByText('US1234567890')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Collapse security details' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('separator', { name: 'Resize security details' })).toHaveAttribute('aria-valuenow', '280')
  })

  it('resizes by dragging, remembers the width, supports keyboard limits and resets on double-click', () => {
    measureLayout(1200)
    const repository = new LocalRepository()
    const view = renderLayout(repository)
    let handle = screen.getByRole('separator', { name: 'Resize security details' })
    pointer(handle, 'pointerdown', 900)
    pointer(handle, 'pointermove', 820)
    pointer(handle, 'pointerup', 820)
    expect(handle).toHaveAttribute('aria-valuenow', '360')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!)).toEqual({ width: 360, collapsed: false })

    view.unmount()
    renderLayout(repository)
    handle = screen.getByRole('separator', { name: 'Resize security details' })
    expect(handle).toHaveAttribute('aria-valuenow', '360')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(handle).toHaveAttribute('aria-valuenow', '376')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle).toHaveAttribute('aria-valuenow', '360')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle).toHaveAttribute('aria-valuenow', '520')

    pointer(handle, 'pointerdown', 800)
    pointer(handle, 'pointermove', 0)
    expect(handle).toHaveAttribute('aria-valuenow', '520')
    pointer(handle, 'pointermove', 2000)
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    pointer(handle, 'pointercancel', 2000)
    pointer(handle, 'pointermove', 0)
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    fireEvent.doubleClick(handle)
    expect(handle).toHaveAttribute('aria-valuenow', '280')
  })

  it('fits the available width and stacks on small windows without forgetting the preferred width', () => {
    const resizeWindow = measureLayout(1000)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ width: 520, collapsed: false }))
    renderLayout()
    let handle = screen.getByRole('separator', { name: 'Resize security details' })
    expect(handle).toHaveAttribute('aria-valuenow', '394')
    expect(handle).toHaveAttribute('aria-valuemax', '394')

    resizeWindow(800)
    expect(screen.queryByRole('separator', { name: 'Resize security details' })).not.toBeInTheDocument()
    const layout = screen.getByRole('complementary', { name: 'Security details' }).parentElement
    expect(layout).toHaveClass('is-stacked')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse security details' }))
    expect(layout).toHaveClass('is-collapsed')
    expect(layout).not.toHaveClass('is-stacked')
    fireEvent.click(screen.getByRole('button', { name: 'Show security details' }))
    expect(layout).toHaveClass('is-stacked')

    resizeWindow(1400)
    expect(layout).not.toHaveClass('is-stacked')
    handle = screen.getByRole('separator', { name: 'Resize security details' })
    expect(handle).toHaveAttribute('aria-valuenow', '520')
    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY)!).width).toBe(520)
  })
})
