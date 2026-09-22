import { useSyncExternalStore } from 'react'
import { getPriceActivity, subscribePriceActivity } from '../utils/priceActivity'

export function PriceActivityIndicator(){
  const active=useSyncExternalStore(subscribePriceActivity,getPriceActivity,()=>false)
  return <div className="sidebar-price-status">{active&&<div className="sidebar-price-progress" role="progressbar" aria-label="Loading / updating price data" title="Loading / updating price data"><span/></div>}</div>
}
