// Normalize clipboard presentation before Tiptap parses its semantic structure.
// Saved notes and formatting applied with the editor toolbar are unaffected.
export function normalizePastedHtml(html:string):string {
  const document=new DOMParser().parseFromString(html,'text/html')
  document.querySelectorAll('style,script,link,meta').forEach((element)=>element.remove())
  for(const element of document.body.querySelectorAll<HTMLElement>('*')){
    const emphasis=['font-weight','font-style','text-decoration','text-decoration-line']
      .map((property)=>[property,element.style.getPropertyValue(property)] as const)
      .filter(([,value])=>value)
    for(const attribute of ['style','class','id','face','size','color','bgcolor','align','width','height'])element.removeAttribute(attribute)
    for(const [property,value] of emphasis)element.style.setProperty(property,value)
    // A mark element would otherwise reintroduce source highlighting.
    if(element.tagName==='MARK')element.replaceWith(...element.childNodes)
  }
  return document.body.innerHTML
}
