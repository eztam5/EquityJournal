export interface YahooPricePoint {
  timestamp: number
  close: number
  adjustedClose: number
}

export interface YahooPriceHistory {
  symbol: string
  currency: string
  exchangeName: string
  timeZone: string
  companyName: string
  prices: YahooPricePoint[]
}

export interface YahooSecuritySearchResult {
  symbol: string
  name: string
  exchange: string
  exchangeName: string
  quoteType: string
}

export function isTauriDesktop() { return '__TAURI_INTERNALS__' in window }

function normalizeHistory(value:YahooPriceHistory):YahooPriceHistory {
  const prices=value.prices.filter((point)=>Number.isFinite(point.timestamp)&&Number.isFinite(point.close)&&Number.isFinite(point.adjustedClose)&&point.close>0&&point.adjustedClose>0).toSorted((left,right)=>left.timestamp-right.timestamp)
  if(!prices.length)throw new Error(`Yahoo Finance returned no daily prices for ${value.symbol}.`)
  return {...value,symbol:value.symbol.toUpperCase(),prices}
}

export async function fetchYahooPriceHistory(symbol:string,range:'1d'|'1mo'|'10y'='10y'):Promise<YahooPriceHistory> {
  const normalized=symbol.trim().toUpperCase()
  if(!normalized)throw new Error('Enter a Yahoo Finance symbol first.')
  if(isTauriDesktop()){
    const{invoke}=await import('@tauri-apps/api/core')
    return normalizeHistory(await invoke<YahooPriceHistory>('fetch_yahoo_prices',{symbol:normalized,range}))
  }
  const response=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?range=${range}&interval=1d&events=div%2Csplits`)
  if(!response.ok)throw new Error(response.status===404?`Yahoo Finance could not find the symbol ${normalized}.`:`Yahoo Finance returned an error (${response.status}).`)
  const body=await response.json() as {chart:{result?:Array<{meta:{symbol:string;currency?:string;exchangeName?:string;exchangeTimezoneName?:string;longName?:string;shortName?:string};timestamp?:number[];indicators:{quote?:Array<{close?:Array<number|null>}>;adjclose?:Array<{adjclose?:Array<number|null>}>}}>;error?:{description?:string}}}
  if(body.chart.error)throw new Error(body.chart.error.description||'Yahoo Finance could not load this symbol.')
  const result=body.chart.result?.[0]
  if(!result)throw new Error(`Yahoo Finance returned no prices for ${normalized}.`)
  const closes=result.indicators.quote?.[0]?.close??[],adjusted=result.indicators.adjclose?.[0]?.adjclose??[]
  return normalizeHistory({symbol:result.meta.symbol,currency:result.meta.currency??'',exchangeName:result.meta.exchangeName??'',timeZone:result.meta.exchangeTimezoneName??'UTC',companyName:result.meta.longName??result.meta.shortName??'',prices:(result.timestamp??[]).flatMap((timestamp,index)=>{const close=closes[index],adjustedClose=adjusted[index]??close;return close&&adjustedClose?[{timestamp,close,adjustedClose}]:[]})})
}

export async function searchYahooSecurities(query:string):Promise<YahooSecuritySearchResult[]> {
  const normalized=query.trim()
  if(normalized.length<2)return []
  if(isTauriDesktop()){
    const{invoke}=await import('@tauri-apps/api/core')
    return invoke<YahooSecuritySearchResult[]>('search_yahoo_securities',{query:normalized})
  }
  const params=new URLSearchParams({q:normalized,quotesCount:'8',newsCount:'0'})
  const response=await fetch(`https://query2.finance.yahoo.com/v1/finance/search?${params}`)
  if(!response.ok)throw new Error(`Yahoo Finance search returned an error (${response.status}).`)
  const body=await response.json() as {quotes?:Array<{symbol?:string;shortname?:string;longname?:string;exchange?:string;exchDisp?:string;quoteType?:string;isYahooFinance?:boolean}>}
  const seen=new Set<string>()
  return (body.quotes??[]).flatMap((quote)=>{
    const symbol=quote.symbol?.trim().toUpperCase()
    if(!symbol||quote.isYahooFinance===false||seen.has(symbol))return []
    seen.add(symbol)
    return [{symbol,name:quote.longname??quote.shortname??symbol,exchange:quote.exchange??'',exchangeName:quote.exchDisp??'',quoteType:quote.quoteType??''}]
  })
}

export function yahooTimestampDate(timestamp:number,timeZone='UTC') {
  const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone}).formatToParts(new Date(timestamp*1000)),value=(type:Intl.DateTimeFormatPartTypes)=>parts.find((part)=>part.type===type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
