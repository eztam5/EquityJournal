import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SecurityPrice } from '../domain/types'
import { WatchlistPriceSparkline } from './WatchlistPriceSparkline'

afterEach(cleanup)
const price=(priceDate:string,adjustedClose:number):SecurityPrice=>({securityId:'test',priceDate,close:adjustedClose,adjustedClose,currency:'USD',sourceSymbol:'TEST',fetchedAt:''})

describe('watchlist sparklines',()=>{
  it('sorts dates and displays a rising trend with evenly scaled dates',()=>{
    render(<WatchlistPriceSparkline name="Test" prices={[price('2026-10-19',120),price('2026-10-01',100),price('2026-10-10',110)]}/>)
    const chart=screen.getByRole('img',{name:'Test: one month price trend'})
    expect(chart).toHaveClass('positive')
    expect(chart.querySelector('path')).toHaveAttribute('d','M2.00,22.00 L48.00,12.00 L94.00,2.00')
  })
  it('renders flat prices without invalid geometry',()=>{
    render(<WatchlistPriceSparkline name="Test" prices={[price('2026-10-01',100),price('2026-10-19',100)]}/>)
    expect(screen.getByRole('img').querySelector('path')).toHaveAttribute('d','M2.00,12.00 L94.00,12.00')
  })
  it('shows a placeholder for insufficient data',()=>{
    render(<WatchlistPriceSparkline name="Test" prices={[price('2026-10-19',100)]}/>)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTitle('Not enough cached price history')).toHaveTextContent('—')
  })
})
