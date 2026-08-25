import { Icon } from '@blueprintjs/core'

interface TaxonomyMarkerProps {
  color:string
  expanded?:boolean
  expandable:boolean
  label?:string
  onToggle?():void
}

export function TaxonomyMarker({color,expanded,expandable,label,onToggle}:TaxonomyMarkerProps) {
  const className=`taxonomy-sidebar-marker ${expandable?'expandable':'leaf'}`
  const style={'--tag-color':color} as React.CSSProperties
  const marker=expandable&&<Icon icon={expanded?'chevron-down':'chevron-right'} size={10}/>
  if(onToggle&&expandable)return <button type="button" className={className} style={style} aria-label={`${expanded?'Collapse':'Expand'} ${label??'item'}`} onClick={(event)=>{event.stopPropagation();onToggle()}}>{marker}</button>
  return <span className={className} style={style}>{marker}</span>
}
