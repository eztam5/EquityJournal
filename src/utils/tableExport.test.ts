import { describe, expect, it } from 'vitest'
import { csvFileName, exportTableAsCsv, exportTableAsHtml, type ExportTable } from './tableExport'

const table:ExportTable={
  headers:['Symbol','Company','Research link'],
  rows:[
    [{text:'ACME'},{text:'Acme, Inc.'},{text:'https://example.com/?q=ACME&view=full',href:'https://example.com/?q=ACME&view=full'}],
    [{text:'QUOTE'},{text:'A "quoted" company'},{text:''}],
  ],
}

describe('table export',()=>{
  it('creates RFC-style CSV with escaped values and CRLF rows',()=>{
    expect(exportTableAsCsv(table)).toBe('Symbol,Company,Research link\r\nACME,"Acme, Inc.",https://example.com/?q=ACME&view=full\r\nQUOTE,"A ""quoted"" company",')
  })

  it('creates an escaped HTML table with clickable links',()=>{
    expect(exportTableAsHtml(table)).toBe('<table><thead><tr><th>Symbol</th><th>Company</th><th>Research link</th></tr></thead><tbody><tr><td>ACME</td><td>Acme, Inc.</td><td><a href="https://example.com/?q=ACME&amp;view=full">https://example.com/?q=ACME&amp;view=full</a></td></tr><tr><td>QUOTE</td><td>A &quot;quoted&quot; company</td><td></td></tr></tbody></table>')
  })

  it('creates a safe CSV filename from the view title',()=>{
    expect(csvFileName('Price & Quality / Ideas')).toBe('price-quality-ideas.csv')
  })
})
