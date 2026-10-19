import type { SecurityPrice } from '../domain/types'

export function WatchlistPriceSparkline({prices,name}:{prices:SecurityPrice[];name:string}) {
  const points=prices.filter((price)=>Number.isFinite(price.adjustedClose)).toSorted((a,b)=>a.priceDate.localeCompare(b.priceDate))
  if(points.length<2)return <span className="watchlist-sparkline-empty" title="Not enough cached price history">—</span>
  const values=points.map((point)=>point.adjustedClose),min=Math.min(...values),max=Math.max(...values)
  const start=Date.parse(points[0].priceDate),span=Math.max(Date.parse(points.at(-1)!.priceDate)-start,1)
  const path=points.map((point,index)=>`${index?'L':'M'}${(2+(Date.parse(point.priceDate)-start)/span*92).toFixed(2)},${(max===min?12:22-(point.adjustedClose-min)/(max-min)*20).toFixed(2)}`).join(' ')
  const change=values.at(-1)!-values[0],trend=change>0?'positive':change<0?'negative':'neutral'
  return <svg className={`watchlist-price-sparkline ${trend}`} viewBox="0 0 96 24" role="img" aria-label={`${name}: one month price trend`}><title>Adjusted closing prices · {points[0].priceDate} to {points.at(-1)!.priceDate}</title><path d={path}/></svg>
}
