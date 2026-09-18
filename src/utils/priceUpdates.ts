import type { EquityRepository } from '../data/repository'
import type { Security } from '../domain/types'
import { fetchYahooPriceHistory, yahooTimestampDate, type YahooPriceHistory } from './yahooFinance'

export const DEFAULT_PRICE_UPDATE_INTERVAL_MINUTES=15
export const MIN_PRICE_UPDATE_INTERVAL_MINUTES=1
export const MAX_PRICE_UPDATE_INTERVAL_MINUTES=24*60
export const PRICE_UPDATE_INTERVAL_KEY='equity-journal.price-update-interval-minutes'
export const PRICE_HISTORY_CHANGED_EVENT='equity-journal:price-history-changed'

export function normalizePriceUpdateIntervalMinutes(value:unknown):number {
  const minutes=Number(value)
  if(!Number.isFinite(minutes))return DEFAULT_PRICE_UPDATE_INTERVAL_MINUTES
  return Math.min(MAX_PRICE_UPDATE_INTERVAL_MINUTES,Math.max(MIN_PRICE_UPDATE_INTERVAL_MINUTES,Math.round(minutes)))
}

export function loadPriceUpdateIntervalMinutes():number {
  return normalizePriceUpdateIntervalMinutes(localStorage.getItem(PRICE_UPDATE_INTERVAL_KEY)??DEFAULT_PRICE_UPDATE_INTERVAL_MINUTES)
}

type PriceFetcher=(symbol:string,range:'1d')=>Promise<YahooPriceHistory>

export interface PriceUpdateResult {
  updatedSecurityIds:string[]
  failures:Array<{securityId:string;symbol:string;message:string}>
}

export async function updateLatestSecurityPrices(repository:EquityRepository,securities:Security[],fetcher:PriceFetcher=fetchYahooPriceHistory):Promise<PriceUpdateResult> {
  const updatedSecurityIds:string[]=[],failures:PriceUpdateResult['failures']=[]
  for(const security of securities){
    try{
      const history=await fetcher(security.symbol,'1d'),latest=history.prices.at(-1)
      if(!latest)throw new Error('Yahoo Finance returned no recent price.')
      await repository.saveSecurityPrices(security.id,security.symbol,history.currency||security.currency,[{priceDate:yahooTimestampDate(latest.timestamp,history.timeZone),close:latest.close,adjustedClose:latest.adjustedClose}])
      updatedSecurityIds.push(security.id)
    }catch(reason){failures.push({securityId:security.id,symbol:security.symbol,message:reason instanceof Error?reason.message:String(reason)})}
  }
  return {updatedSecurityIds,failures}
}

export function notifyPriceHistoryChanged(securityIds:string[]) {
  if(securityIds.length)window.dispatchEvent(new CustomEvent(PRICE_HISTORY_CHANGED_EVENT,{detail:{securityIds}}))
}
