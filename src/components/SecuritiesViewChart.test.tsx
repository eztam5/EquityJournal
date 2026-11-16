import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecuritiesView } from './SecuritiesView'
import { SecurityDetailView } from './SecurityDetailView'

const HEIGHT_KEY = 'equity-journal.watchlist-chart-height.v1'

function NavigationHarness() {
  const app = useApp()
  return app.view.type === 'security' ? <SecurityDetailView id={app.view.id}/> : <SecuritiesView/>
}

async function fixtures() {
  const repository = new LocalRepository()
  await repository.initialize()
  const apple = await repository.addSecurity({ symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD' })
  const nestle = await repository.addSecurity({ symbol: 'NESN', name: 'Nestlé', currency: 'CHF' })
  for (const security of [apple, nestle]) await repository.saveSecurityPrices(security.id, security.symbol, security.currency, [
    { priceDate: '2025-09-18', close: 100, adjustedClose: 100 },
    { priceDate: '2026-09-18', close: 125, adjustedClose: 125 },
  ])
  const watchlist = await repository.addWatchlist('Quality')
  for (const security of [apple, nestle]) await repository.setWatchlistSecurity(watchlist.id, security.id, true)
  return { repository, apple, nestle, watchlist }
}

function measureWorkspace(initialHeight: number) {
  let height = initialHeight
  const original = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('watchlist-chart-workspace') ? { x: 0, y: 0, top: 0, left: 0, right: 1200, bottom: height, width: 1200, height, toJSON() { return {} } } : original.call(this)
  })
  return (nextHeight: number) => { height = nextHeight; fireEvent(window, new Event('resize')) }
}

function pointer(element: HTMLElement, type: string, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  fireEvent(element, event)
}

describe('Watchlist bottom price chart', () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); document.documentElement.classList.remove('watchlist-security-dragging') })

  it.each([false, true])('previews the clicked security below the list using the full chart (watchlist: %s)', async (inWatchlist) => {
    const { repository, watchlist } = await fixtures()
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={inWatchlist ? watchlist.id : undefined}/></AppProvider>)
    const row = (await screen.findByText('Apple Inc.')).closest('tr')!
    expect(screen.queryByRole('region', { name: 'AAPL — Apple Inc.' })).not.toBeInTheDocument()
    fireEvent.click(row)

    const panel = await screen.findByRole('region', { name: 'AAPL — Apple Inc.' })
    expect(await within(panel).findByRole('img', { name: /adjusted closing price in USD/i })).toBeInTheDocument()
    expect(within(panel).getByText('+25.0%')).toBeInTheDocument()
    for (const range of ['1M', '2M', '6M', '1Y', '2Y', '5Y', '10Y', 'YTD']) expect(within(panel).getByRole('button', { name: range })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Refresh prices' })).toBeInTheDocument()
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('table').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { name: inWatchlist ? 'Quality' : 'All Securities' })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Nestlé').closest('tr')!)
    const nextPanel = screen.getByRole('region', { name: 'NESN — Nestlé' })
    expect(await within(nextPanel).findByRole('img', { name: /adjusted closing price in CHF/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'AAPL — Apple Inc.' })).not.toBeInTheDocument()
    fireEvent.click(within(nextPanel).getByRole('button', { name: 'Close price chart' }))
    expect(screen.queryByRole('separator', { name: 'Resize price chart panel' })).not.toBeInTheDocument()
  })

  it('keeps double-click navigation to the security detail view', async () => {
    const { repository } = await fixtures()
    render(<AppProvider repository={repository}><NavigationHarness/></AppProvider>)
    const row = (await screen.findByText('Apple Inc.')).closest('tr')!
    fireEvent.click(row)
    expect(screen.getByRole('region', { name: 'AAPL — Apple Inc.' })).toBeInTheDocument()
    fireEvent.doubleClick(row)
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
  })

  it('opens the selected journal entry from a chart marker', async () => {
    const { repository, apple } = await fixtures()
    await repository.saveJournalEntry({ securityId: apple.id, entryDate: '2026-03-12', contentHtml: '<p>Annual report review</p>' })
    await repository.saveJournalEntry({ securityId: apple.id, entryDate: '2026-07-01', contentHtml: '<p>Later review</p>' })
    render(<AppProvider repository={repository}><NavigationHarness/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    fireEvent.click(await screen.findByRole('button', { name: 'Open journal entry from 2026-03-12' }))
    expect(await screen.findByRole('heading', { name: 'AAPL' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Journal' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByDisplayValue('2026-03-12')).toBeInTheDocument()
  })

  it('resizes by dragging and keyboard, preserves height across securities and remounts, and fits smaller windows', async () => {
    const resizeWindow = measureWorkspace(900)
    const { repository } = await fixtures()
    const view = render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    let handle = screen.getByRole('separator', { name: 'Resize price chart panel' })
    pointer(handle, 'pointerdown', 600)
    pointer(handle, 'pointermove', 500)
    pointer(handle, 'pointerup', 500)
    expect(handle).toHaveAttribute('aria-valuenow', '460')
    expect(localStorage.getItem(HEIGHT_KEY)).toBe('460')
    fireEvent.click(screen.getByText('Nestlé').closest('tr')!)
    expect(handle).toHaveAttribute('aria-valuenow', '460')
    view.unmount()

    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    handle = screen.getByRole('separator', { name: 'Resize price chart panel' })
    expect(handle).toHaveAttribute('aria-valuenow', '460')
    resizeWindow(500)
    expect(handle).toHaveAttribute('aria-valuenow', '334')
    expect(localStorage.getItem(HEIGHT_KEY)).toBe('460')
    resizeWindow(900)
    expect(handle).toHaveAttribute('aria-valuenow', '460')
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(handle).toHaveAttribute('aria-valuenow', '476')
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(handle).toHaveAttribute('aria-valuenow', '460')
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    fireEvent.keyDown(handle, { key: 'End' })
    expect(handle).toHaveAttribute('aria-valuenow', '720')
    fireEvent.doubleClick(handle)
    expect(handle).toHaveAttribute('aria-valuenow', '360')
  })

  it('closes when changing watchlists or filtering out the selected security', async () => {
    const { repository, watchlist } = await fixtures()
    const view = render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    view.rerender(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)
    await screen.findByRole('heading', { name: 'Quality' })
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search securities' }), { target: { value: 'NESN' } })
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
  })

  it('closes when the selected security is removed from the watchlist', async () => {
    const { repository, watchlist } = await fixtures()
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={watchlist.id}/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Apple Inc.' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove from watchlist' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument())
    expect(screen.queryByText('Apple Inc.')).not.toBeInTheDocument()
  })

  it('does not open the chart for row actions or the click following a drag', async () => {
    const { repository } = await fixtures()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    const row = (await screen.findByText('Apple Inc.')).closest('tr')!
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Apple Inc.' }))
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit security' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit security' })).getByRole('button', { name: 'Cancel' }))
    pointer(row, 'pointerdown', 10)
    pointer(row, 'pointermove', 30)
    pointer(row, 'pointerup', 30)
    fireEvent.click(row)
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
  })
})
