import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ButtonGroup, Callout, Card, Spinner, Tooltip } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { Security, SecurityJournalEntry, SecurityPrice } from '../domain/types'
import { fetchYahooPriceHistory, isTauriDesktop, yahooTimestampDate, type YahooPricePoint } from '../utils/yahooFinance'
import { PRICE_HISTORY_CHANGED_EVENT } from '../utils/priceUpdates'

export const PRICE_RANGES=['1M','2M','6M','1Y','2Y','5Y','10Y','YTD'] as const
export type PriceRange=typeof PRICE_RANGES[number]

export function priceRangeStart(latestDate:string,range:PriceRange) {
  const latest=new Date(`${latestDate}T00:00:00Z`)
  if(range==='YTD')return `${latest.getUTCFullYear()}-01-01`
  const amount=Number.parseInt(range),unit=range.at(-1),day=latest.getUTCDate()
  latest.setUTCDate(1)
  if(unit==='M')latest.setUTCMonth(latest.getUTCMonth()-amount)
  else latest.setUTCFullYear(latest.getUTCFullYear()-amount)
  const lastDay=new Date(Date.UTC(latest.getUTCFullYear(),latest.getUTCMonth()+1,0)).getUTCDate()
  latest.setUTCDate(Math.min(day,lastDay))
  return latest.toISOString().slice(0,10)
}

export function pricesInRange(prices:SecurityPrice[],range:PriceRange) {
  if(!prices.length)return []
  const ordered=prices.toSorted((left,right)=>left.priceDate.localeCompare(right.priceDate)),start=priceRangeStart(ordered.at(-1)!.priceDate,range)
  return ordered.filter((price)=>price.priceDate>=start)
}

function chartGeometry(values:Array<{date:string;value:number}>,width=1000,height=320) {
  const left=70,right=76,top=28,bottom=42,plotWidth=width-left-right,plotHeight=height-top-bottom
  const dates=values.map((point)=>new Date(`${point.date}T00:00:00Z`).valueOf()),rawMin=Math.min(...values.map((point)=>point.value)),rawMax=Math.max(...values.map((point)=>point.value)),padding=Math.max((rawMax-rawMin)*.08,rawMax*.01,0.01),min=rawMin-padding,max=rawMax+padding,dateMin=dates[0],dateMax=dates.at(-1)!,dateSpan=Math.max(dateMax-dateMin,1)
  const points=values.map((point,index)=>({x:left+(dates[index]-dateMin)/dateSpan*plotWidth,y:top+(max-point.value)/(max-min)*plotHeight,...point}))
  return {left,right,top,bottom,plotWidth,plotHeight,min,max,points,width,height}
}

function formatPrice(value:number){return new Intl.NumberFormat(undefined,{maximumFractionDigits:value>=100?1:2}).format(value)}
function formatDate(value:string){return new Intl.DateTimeFormat(undefined,{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`))}

export function PriceSparkline({prices,label='Price preview'}:{prices:YahooPricePoint[];label?:string}) {
  if(prices.length<2)return null
  const values=prices.map((price)=>({date:yahooTimestampDate(price.timestamp),value:price.adjustedClose})),geometry=chartGeometry(values,360,90),path=geometry.points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  return <svg className="price-sparkline" viewBox="0 0 360 90" role="img" aria-label={label} preserveAspectRatio="none"><path d={path}/></svg>
}

function PriceChartSvg({prices,currency,securityId,journalEntries,onJournalEntryClick}:{prices:SecurityPrice[];currency:string;securityId:string;journalEntries:SecurityJournalEntry[];onJournalEntryClick?(entry:SecurityJournalEntry):void}) {
  const values=prices.map((price)=>({date:price.priceDate,value:price.adjustedClose})),geometry=chartGeometry(values),base=values[0].value
  const line=geometry.points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),bottomY=geometry.height-geometry.bottom,area=`${line} L${geometry.points.at(-1)!.x.toFixed(1)},${bottomY} L${geometry.points[0].x.toFixed(1)},${bottomY} Z`,gradientId=`price-area-${securityId.replace(/[^a-zA-Z0-9_-]/g,'')}`
  const yTicks=Array.from({length:5},(_,index)=>{const ratio=index/4,value=geometry.max-(geometry.max-geometry.min)*ratio;return {y:geometry.top+geometry.plotHeight*ratio,value,percent:(value/base-1)*100}})
  const xIndexes=[0,.25,.5,.75,1].map((ratio)=>Math.round((prices.length-1)*ratio)).filter((value,index,items)=>items.indexOf(value)===index)
  const dateValue=(date:string)=>new Date(`${date}T00:00:00Z`).valueOf(),firstDate=dateValue(prices[0].priceDate),lastDate=dateValue(prices.at(-1)!.priceDate),dateSpan=Math.max(lastDate-firstDate,1)
  const markers=journalEntries.filter((entry)=>entry.entryDate>=prices[0].priceDate&&entry.entryDate<=prices.at(-1)!.priceDate).map((entry)=>{
    const x=geometry.left+(dateValue(entry.entryDate)-firstDate)/dateSpan*geometry.plotWidth,rightIndex=Math.max(1,geometry.points.findIndex((point)=>point.x>=x)),left=geometry.points[rightIndex-1],right=geometry.points[rightIndex]??left,ratio=right.x===left.x?0:(x-left.x)/(right.x-left.x),y=left.y+(right.y-left.y)*ratio
    return {entry,x,y}
  })
  return <svg className="security-price-svg" viewBox="0 0 1000 320" role="img" aria-label={`Adjusted closing price in ${currency} with percentage change`}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".2"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs>
    {yTicks.map((tick)=><g key={tick.y}><line className="price-grid-line" x1={geometry.left} x2={geometry.width-geometry.right} y1={tick.y} y2={tick.y}/><text className="price-axis-label" x={geometry.left-10} y={tick.y+4} textAnchor="end">{formatPrice(tick.value)}</text><text className="price-axis-label" x={geometry.width-geometry.right+10} y={tick.y+4}>{tick.percent>=0?'+':''}{tick.percent.toFixed(1)}%</text></g>)}
    <path className="price-area" d={area} fill={`url(#${gradientId})`}/><path className="price-line" d={line}/>
    {markers.map(({entry,x,y})=><g key={entry.id} className="price-journal-marker" role="button" tabIndex={0} aria-label={`Open journal entry from ${entry.entryDate}`} onClick={()=>onJournalEntryClick?.(entry)} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onJournalEntryClick?.(entry)}}}><title>Journal entry · {entry.entryDate}</title><circle className="price-journal-marker-halo" cx={x} cy={y} r="8"/><circle cx={x} cy={y} r="4"/></g>)}
    {xIndexes.map((index)=><text className="price-axis-label" key={prices[index].priceDate} x={geometry.points[index].x} y={geometry.height-12} textAnchor={index===0?'start':index===prices.length-1?'end':'middle'}>{formatDate(prices[index].priceDate)}</text>)}
    <text className="price-axis-title" x="12" y="18">{currency||'Price'}</text><text className="price-axis-title" x="988" y="18" textAnchor="end">Change</text>
  </svg>
}

export function SecurityPriceChart({security,journalRevision=0,onJournalEntryClick}:{security:Security;journalRevision?:number;onJournalEntryClick?(entry:SecurityJournalEntry):void}) {
  const app=useApp(),[prices,setPrices]=useState<SecurityPrice[]>([]),[journalEntries,setJournalEntries]=useState<SecurityJournalEntry[]>([]),[range,setRange]=useState<PriceRange>('1Y'),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=useCallback(async(force=false)=>{setLoading(true);setError('');try{
    const cached=(await app.repository.listSecurityPrices(security.id)).filter((price)=>price.sourceSymbol.toUpperCase()===security.symbol.toUpperCase())
    if(cached.length>=2&&!force){setPrices(cached);return}
    if(!force&&!isTauriDesktop()){setPrices(cached);return}
    const history=await fetchYahooPriceHistory(security.symbol,'10y'),records=history.prices.map((price)=>({priceDate:yahooTimestampDate(price.timestamp,history.timeZone),close:price.close,adjustedClose:price.adjustedClose}))
    setPrices(await app.repository.saveSecurityPrices(security.id,security.symbol,history.currency||security.currency,records))
  }catch(reason){setError(reason instanceof Error?reason.message:String(reason))}finally{setLoading(false)}},[app.repository,security.currency,security.id,security.symbol])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{
    const refreshCached=(event:Event)=>{const ids=(event as CustomEvent<{securityIds:string[]}>).detail?.securityIds;if(!ids?.includes(security.id))return;void app.repository.listSecurityPrices(security.id).then((cached)=>setPrices(cached.filter((price)=>price.sourceSymbol.toUpperCase()===security.symbol.toUpperCase())))}
    window.addEventListener(PRICE_HISTORY_CHANGED_EVENT,refreshCached)
    return()=>window.removeEventListener(PRICE_HISTORY_CHANGED_EVENT,refreshCached)
  },[app.repository,security.id,security.symbol])
  useEffect(()=>{let active=true;app.repository.listJournalEntries(security.id).then((entries)=>{if(active)setJournalEntries(entries)}).catch(()=>{if(active)setJournalEntries([])});return()=>{active=false}},[app.repository,security.id,journalRevision])
  const visible=useMemo(()=>pricesInRange(prices,range),[prices,range]),first=visible[0],last=visible.at(-1),change=first&&last?(last.adjustedClose/first.adjustedClose-1)*100:0,currency=last?.currency||security.currency
  return <Card className="content-panel price-chart-card" elevation={0}><header><div><h2>Price history</h2>{last&&<p><strong>{formatPrice(last.adjustedClose)} {currency}</strong><span className={change<0?'negative':'positive'}>{change>=0?'+':''}{change.toFixed(1)}%</span><small>Adjusted close · through {last.priceDate}</small></p>}</div><div className="price-chart-actions"><ButtonGroup className="price-range-buttons" aria-label="Price chart range">{PRICE_RANGES.map((item)=><Button key={item} text={item} active={range===item} small onClick={()=>setRange(item)}/>)}</ButtonGroup><Tooltip content="Refresh prices from Yahoo Finance" hoverOpenDelay={500}><Button icon="refresh" minimal aria-label="Refresh prices" loading={loading} onClick={()=>void load(true)}/></Tooltip></div></header>
    {error&&<Callout className="price-chart-message" intent="warning" icon="warning-sign">{error}</Callout>}
    {loading&&!prices.length?<div className="price-chart-loading"><Spinner size={24}/><span>Loading historical prices…</span></div>:visible.length>=2?<PriceChartSvg prices={visible} currency={currency} securityId={security.id} journalEntries={journalEntries} onJournalEntryClick={onJournalEntryClick}/>:<div className="price-chart-empty">{prices.length?'Not enough price history for this range.':'No cached price history yet. Refresh to load it from Yahoo Finance.'}</div>}
    <footer><span>Source: Yahoo Finance. Prices are cached locally; use refresh to retrieve newer data.</span>{journalEntries.length>0&&<span className="price-journal-legend"><i/>Journal entry</span>}</footer>
  </Card>
}
