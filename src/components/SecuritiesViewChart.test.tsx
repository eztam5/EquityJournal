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
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.classList.remove('watchlist-security-dragging') })

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

  it('refreshes the table prices along with the preview chart', async () => {
    const { repository } = await fixtures()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ chart: { result: [{
      meta: { symbol: 'AAPL', currency: 'USD', exchangeTimezoneName: 'UTC' },
      timestamp: [Date.UTC(2025, 8, 18) / 1000, Date.UTC(2026, 8, 18) / 1000],
      indicators: { quote: [{ close: [100, 150] }], adjclose: [{ adjclose: [100, 150] }] },
    }] } }) }))
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    const row = (await screen.findByText('Apple Inc.')).closest('tr')!
    fireEvent.click(row)
    const panel = screen.getByRole('region', { name: 'AAPL — Apple Inc.' })
    expect(await within(panel).findByText('+25.0%')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Refresh prices' }))
    expect(await within(panel).findByText('+50.0%')).toBeInTheDocument()
    expect(await within(row).findByText('+50.00%')).toBeInTheDocument()
  })

  it.each([false, true])('overlays every company in a Shift-selected range (watchlist: %s)', async (inWatchlist) => {
    const { repository, apple, nestle, watchlist } = await fixtures()
    const microsoft = await repository.addSecurity({ symbol: 'MSFT', name: 'Microsoft', currency: 'USD' })
    await repository.setWatchlistSecurity(watchlist.id, microsoft.id, true)
    for (const [security, base, latest] of [[nestle, 1000, 900], [microsoft, 500, 550]] as const) await repository.saveSecurityPrices(security.id, security.symbol, security.currency, [
      { priceDate: '2025-09-18', close: base, adjustedClose: base },
      { priceDate: '2026-09-18', close: latest, adjustedClose: latest },
    ])
    render(<AppProvider repository={repository}><SecuritiesView watchlistId={inWatchlist ? watchlist.id : undefined}/></AppProvider>)
    const appleRow = (await screen.findByText('Apple Inc.')).closest('tr')!
    const nestleRow = screen.getByText('Nestlé').closest('tr')!
    fireEvent.click(appleRow)
    fireEvent.click(nestleRow, { shiftKey: true })

    const panel = await screen.findByRole('region', { name: 'Compare 3 securities' })
    const chart = await within(panel).findByRole('img', { name: /selected securities price comparison/i })
    const paths = [...chart.querySelectorAll('.comparison-price-line')]
    expect(paths.map((path) => path.getAttribute('data-security-id')).sort()).toEqual([apple.id, nestle.id, microsoft.id].sort())
    expect(new Set(paths.map((path) => (path.parentElement as unknown as SVGElement).style.getPropertyValue('--series-color'))).size).toBe(3)
    const legend = within(panel).getByRole('list', { name: 'Comparison legend' })
    expect(within(legend).getByText('AAPL').closest('li')).toHaveTextContent('+25.0%')
    expect(within(legend).getByText('NESN').closest('li')).toHaveTextContent('-10.0%')
    expect(within(legend).getByText('MSFT').closest('li')).toHaveTextContent('+10.0%')
    for (const row of [appleRow, nestleRow, screen.getByText('Microsoft').closest('tr')!]) expect(row).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(nestleRow)
    expect(await screen.findByRole('region', { name: 'NESN — Nestlé' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /selected securities price comparison/i })).not.toBeInTheDocument()
  })

  it('updates the overlay when companies are toggled with Ctrl or Cmd', async () => {
    const { repository } = await fixtures()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    const appleRow = (await screen.findByText('Apple Inc.')).closest('tr')!
    const nestleRow = screen.getByText('Nestlé').closest('tr')!
    fireEvent.click(appleRow)
    fireEvent.click(nestleRow, { ctrlKey: true, metaKey: true })
    expect(await screen.findByRole('img', { name: /selected securities price comparison/i })).toBeInTheDocument()
    fireEvent.click(nestleRow, { ctrlKey: true, metaKey: true })
    expect(screen.getByRole('region', { name: 'AAPL — Apple Inc.' })).toBeInTheDocument()
    fireEvent.click(nestleRow, { ctrlKey: true, metaKey: true })
    expect(await screen.findByRole('img', { name: /selected securities price comparison/i })).toBeInTheDocument()
    fireEvent.click(appleRow, { ctrlKey: true, metaKey: true })
    expect(screen.getByRole('region', { name: 'NESN — Nestlé' })).toBeInTheDocument()
    fireEvent.click(nestleRow, { ctrlKey: true, metaKey: true })
    expect(screen.queryByRole('button', { name: 'Close price chart' })).not.toBeInTheDocument()
  })

  it('keeps the chosen time range when entering and leaving comparison mode', async () => {
    const { repository } = await fixtures()
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    const appleRow = (await screen.findByText('Apple Inc.')).closest('tr')!
    const nestleRow = screen.getByText('Nestlé').closest('tr')!
    fireEvent.click(appleRow)
    fireEvent.click(screen.getByRole('button', { name: '2Y' }))
    fireEvent.click(nestleRow, { shiftKey: true })
    const panel = screen.getByRole('region', { name: 'Compare 2 securities' })
    expect(within(panel).getByRole('button', { name: '2Y' })).toHaveClass('bp6-active')
    await within(panel).findByRole('img', { name: /selected securities price comparison/i })
    fireEvent.click(within(panel).getByRole('button', { name: '1M' }))
    expect(within(panel).queryByRole('img', { name: /selected securities price comparison/i })).not.toBeInTheDocument()
    expect(within(panel).getAllByText('Not enough history')).toHaveLength(2)
    fireEvent.click(within(panel).getByRole('button', { name: '1Y' }))
    expect(within(panel).getByRole('img', { name: /selected securities price comparison/i })).toBeInTheDocument()
    fireEvent.click(appleRow)
    expect(screen.getByRole('button', { name: '1Y' })).toHaveClass('bp6-active')
  })

  it('identifies companies with missing history and still plots the available series', async () => {
    const { repository } = await fixtures()
    await repository.addSecurity({ symbol: 'ZZZ', name: 'No history company', currency: 'USD' })
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    fireEvent.click(screen.getByText('No history company').closest('tr')!, { shiftKey: true })
    const panel = screen.getByRole('region', { name: 'Compare 3 securities' })
    const chart = await within(panel).findByRole('img', { name: /selected securities price comparison/i })
    expect(chart.querySelectorAll('.comparison-price-line')).toHaveLength(2)
    const legend = within(panel).getByRole('list', { name: 'Comparison legend' })
    expect(within(legend).getByText('ZZZ').closest('li')).toHaveTextContent('Not enough history')
  })

  it('refreshes all compared companies and keeps cached lines when one refresh fails', async () => {
    const { repository } = await fixtures()
    const fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('NESN')) throw new Error('Connection unavailable')
      return { ok: true, json: async () => ({ chart: { result: [{
        meta: { symbol: 'AAPL', currency: 'USD', exchangeTimezoneName: 'UTC' },
        timestamp: [Date.UTC(2025, 8, 18) / 1000, Date.UTC(2026, 8, 18) / 1000],
        indicators: { quote: [{ close: [100, 150] }], adjclose: [{ adjclose: [100, 150] }] },
      }] } }) }
    })
    vi.stubGlobal('fetch', fetch)
    render(<AppProvider repository={repository}><SecuritiesView/></AppProvider>)
    fireEvent.click((await screen.findByText('Apple Inc.')).closest('tr')!)
    fireEvent.click(screen.getByText('Nestlé').closest('tr')!, { shiftKey: true })
    const panel = screen.getByRole('region', { name: 'Compare 2 securities' })
    await within(panel).findByRole('img', { name: /selected securities price comparison/i })
    fireEvent.click(within(panel).getByRole('button', { name: 'Refresh prices' }))
    expect(await within(panel).findByText('NESN: Connection unavailable')).toBeInTheDocument()
    const legend = within(panel).getByRole('list', { name: 'Comparison legend' })
    expect(within(legend).getByText('AAPL').closest('li')).toHaveTextContent('+50.0%')
    expect(within(legend).getByText('NESN').closest('li')).toHaveTextContent('+25.0%')
    expect(panel.querySelectorAll('.comparison-price-line')).toHaveLength(2)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await within(screen.getByText('Apple Inc.').closest('tr')!).findByText('+50.00%')).toBeInTheDocument()
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
    resizeWindow(320)
    fireEvent.keyDown(handle, { key: 'Home' })
    expect(handle).toHaveAttribute('aria-valuenow', '160')
    resizeWindow(900)
    expect(handle).toHaveAttribute('aria-valuenow', '240')
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
