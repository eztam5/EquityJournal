export interface ExportCell {
  text: string
  href?: string
}

export interface ExportTable {
  headers: string[]
  rows: ExportCell[][]
}

const escapeCsvCell=(value:string)=>/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value
const escapeHtml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')

export function exportTableAsCsv(table:ExportTable) {
  return [table.headers,...table.rows.map((row)=>row.map((cell)=>cell.text))].map((row)=>row.map(escapeCsvCell).join(',')).join('\r\n')
}

export function exportTableAsHtml(table:ExportTable) {
  const head=`<thead><tr>${table.headers.map((header)=>`<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>`
  const body=`<tbody>${table.rows.map((row)=>`<tr>${row.map((cell)=>`<td>${cell.href?`<a href="${escapeHtml(cell.href)}">${escapeHtml(cell.text)}</a>`:escapeHtml(cell.text)}</td>`).join('')}</tr>`).join('')}</tbody>`
  return `<table>${head}${body}</table>`
}

export async function copyTextToClipboard(value:string) {
  await navigator.clipboard.writeText(value)
}

export async function copyHtmlTableToClipboard(html:string,plainText:string) {
  if(typeof ClipboardItem!=='undefined'&&navigator.clipboard.write){
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plainText],{type:'text/plain'})})])
    return
  }
  await navigator.clipboard.writeText(html)
}

export async function saveCsvExport(csv:string,fileName:string) {
  if('__TAURI_INTERNALS__' in window){
    const[{save},{writeTextFile}]=await Promise.all([import('@tauri-apps/plugin-dialog'),import('@tauri-apps/plugin-fs')])
    const path=await save({defaultPath:fileName,filters:[{name:'CSV file',extensions:['csv']}]})
    if(!path)return false
    await writeTextFile(path,`\uFEFF${csv}`)
    return true
  }
  const url=URL.createObjectURL(new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url;link.download=fileName;link.click()
  URL.revokeObjectURL(url)
  return true
}

export function csvFileName(title:string) {
  const base=title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'securities'
  return `${base}.csv`
}
