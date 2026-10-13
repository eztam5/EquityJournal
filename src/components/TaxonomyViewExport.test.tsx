import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { TaxonomyView } from './TaxonomyView'
import * as exports from '../utils/tableExport'

vi.mock('../utils/tableExport',async(importOriginal)=>({...await importOriginal<typeof exports>(),copyTextToClipboard:vi.fn(),copyHtmlTableToClipboard:vi.fn(),saveCsvExport:vi.fn()}))
afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks()})

async function setup(){
  const repository=new LocalRepository();await repository.initialize()
  const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
  const parent=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Technology',description:'',color:taxonomy.color})
  const tag=await repository.addTag({taxonomyId:taxonomy.id,parentId:parent.id,name:'Software',description:'Research',color:taxonomy.color})
  const security=await repository.addSecurity({symbol:'AAPL',name:'Apple, Inc.',currency:'USD'})
  await repository.copySecurityTag(security.id,tag.id)
  render(<AppProvider repository={repository}><TaxonomyView id={taxonomy.id}/></AppProvider>)
  await screen.findByText('Technology')
}

async function choose(option:string){
  fireEvent.click(screen.getByRole('button',{name:'Export'}))
  fireEvent.click(await screen.findByRole('menuitem',{name:option}))
}

describe('taxonomy exports',()=>{
  it.each(['Export as CSV to Clipboard','Export as HTML table to Clipboard','Export as CSV to File'])('supports %s including collapsed descendants',async(option)=>{
    await setup()
    expect(screen.queryByText('Software')).not.toBeInTheDocument()
    await choose(option)
    const csv='Type,Classification,Symbol,Alternative ID,Company,Currency,Description\r\nTag,Industry / Technology,,,,,\r\nTag,Industry / Technology / Software,,,,,Research\r\nSecurity,Industry / Technology / Software,AAPL,,"Apple, Inc.",USD,'
    if(option==='Export as CSV to Clipboard')await waitFor(()=>expect(exports.copyTextToClipboard).toHaveBeenCalledWith(csv))
    else if(option==='Export as HTML table to Clipboard')await waitFor(()=>expect(exports.copyHtmlTableToClipboard).toHaveBeenCalledWith(expect.stringContaining('<td>Industry / Technology / Software</td>'),csv))
    else await waitFor(()=>expect(exports.saveCsvExport).toHaveBeenCalledWith(csv,'industry.csv'))
  })

  it('exports filtered results and reports failures',async()=>{
    await setup()
    fireEvent.change(screen.getByRole('searchbox',{name:'Search tags or securities'}),{target:{value:'no match'}})
    vi.mocked(exports.copyTextToClipboard).mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await choose('Export as CSV to Clipboard')
    expect(exports.copyTextToClipboard).toHaveBeenCalledWith('Type,Classification,Symbol,Alternative ID,Company,Currency,Description')
    expect(await screen.findByRole('status')).toHaveTextContent('Export failed: Clipboard unavailable')
  })
})
