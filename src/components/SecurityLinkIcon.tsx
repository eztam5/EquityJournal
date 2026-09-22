import { useEffect, useState } from 'react'
import { Icon } from '@blueprintjs/core'
import { loadSecurityLinkFavicon } from '../utils/securityLinkFavicons'

export function SecurityLinkIcon({path}:{path?:string}) {
  const [source,setSource]=useState<{path:string;url:string}>()
  useEffect(()=>{
    let active=true,url:string|undefined
    setSource(undefined)
    if(path)void loadSecurityLinkFavicon(path).then((loaded)=>{url=loaded;if(active)setSource({path,url:loaded});else URL.revokeObjectURL(loaded)}).catch(()=>{})
    return()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[path])
  return source&&source.path===path?<img className="security-link-favicon" src={source.url} alt="" width={16} height={16} onError={()=>setSource(undefined)}/>:<Icon icon="share" size={16}/>
}
