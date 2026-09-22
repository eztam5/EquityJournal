let activeOperations=0
const listeners=new Set<()=>void>()
export const getPriceActivity=()=>activeOperations>0
export const subscribePriceActivity=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
function notify(){for(const listener of listeners)listener()}

// Count overlapping requests so finishing one cannot hide another active update.
export async function trackPriceActivity<T>(operation:()=>Promise<T>):Promise<T>{
  activeOperations++;notify()
  try{return await operation()}
  finally{activeOperations--;notify()}
}
