import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider, useApp } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { SecurityDetailView } from './SecurityDetailView'
import { ResearchTopicDetailView } from './ResearchTopicDetailView'

function SecurityTopicNavigation({ securityId }: { securityId: string }) {
  const app = useApp()
  if (app.view.type === 'security') return <SecurityDetailView id={app.view.id}/>
  if (app.view.type === 'topic') return <ResearchTopicDetailView id={app.view.id}/>
  return <button onClick={() => app.openSecurity(securityId)}>Open security</button>
}

describe('SecurityDetailView research notes',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('loads the note belonging to each security when navigating between them',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const apple=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const microsoft=await repository.addSecurity({symbol:'MSFT',name:'Microsoft',currency:'USD'})
    await repository.saveNote(apple.id,'<p>Apple thesis</p>')
    await repository.saveNote(microsoft.id,'<p>Microsoft thesis</p>')

    const view=render(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={microsoft.id}/></AppProvider>)
    expect(await screen.findByText('Microsoft thesis')).toBeInTheDocument()
    expect(screen.queryByText('Apple thesis')).not.toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={apple.id}/></AppProvider>)
    expect(await screen.findByText('Apple thesis')).toBeInTheDocument()
    expect(screen.queryByText('Microsoft thesis')).not.toBeInTheDocument()
  })

  it('shows dated journal entries separately from the current thesis',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',name:'Nestlé',currency:'CHF'})
    await repository.saveNote(security.id,'<p>Current thesis text</p>')
    await repository.saveJournalEntry({securityId:security.id,entryDate:'2026-08-18',contentHtml:'<p>Half-year report review</p>'})

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)
    expect(await screen.findByText('Current thesis text')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab',{name:'Journal'}))

    expect(await screen.findByText('Half-year report review')).toBeInTheDocument()
    expect(screen.queryByText('Current thesis text')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-08-18')).toBeInTheDocument()
  })

  it('keeps the identity and navigation in the top bar with other details and links in the side panel',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',alternativeId:'US0378331005',name:'Apple Inc.',currency:'USD'})
    await repository.saveSecurityLinkTemplates([{id:'yahoo',linkText:'Yahoo Finance',urlPattern:'https://finance.yahoo.com/quote/{SYMBOL}',sortOrder:0}])

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    const link=await screen.findByRole('button',{name:'Yahoo Finance'})
    const panel=screen.getByRole('complementary',{name:'Security details'})
    expect(link).toHaveAttribute('title','https://finance.yahoo.com/quote/AAPL')
    expect(link).toHaveTextContent('Yahoo Finance')
    expect(panel).toContainElement(link)
    expect(link.querySelector('[data-icon="share"]')).toBeInTheDocument()
    const header=document.querySelector<HTMLElement>('.detail-page > .page-header')!
    expect(header).toBeInTheDocument()
    expect(within(header).getByRole('heading',{name:'AAPL'})).toBeInTheDocument()
    expect(within(header).getByText('Apple Inc.')).toBeInTheDocument()
    expect(within(header).getByRole('button',{name:'Back'})).toBeInTheDocument()
    expect(within(header).getByRole('button',{name:'Edit security'})).toBeInTheDocument()
    expect(within(panel).queryByText('AAPL')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Apple Inc.')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button',{name:'Back'})).not.toBeInTheDocument()
    expect(within(panel).getByText('US0378331005')).toBeInTheDocument()
    expect(within(panel).getByText('USD')).toBeInTheDocument()
    expect(document.querySelector('.info-card')).not.toBeInTheDocument()
    const chart=document.querySelector('.price-chart-card')!
    expect(header.compareDocumentPosition(chart)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const research=screen.getByRole('heading',{name:'Research'}).closest('.notes-card')!
    expect(chart.parentElement).toBe(research.parentElement)
    expect(chart.parentElement).toHaveClass('security-main-column')
    expect(panel.parentElement).toBe(chart.parentElement?.parentElement)
    expect(chart.compareDocumentPosition(research)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows cached price history with all requested chart ranges',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    await repository.saveSecurityPrices(security.id,'AAPL','USD',[{priceDate:'2025-09-18',close:200,adjustedClose:200},{priceDate:'2026-09-18',close:250,adjustedClose:250}])
    await repository.saveJournalEntry({securityId:security.id,entryDate:'2026-03-12',contentHtml:'<p>Reviewed the annual report</p>'})
    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    expect(await screen.findByRole('img',{name:/adjusted closing price/i})).toBeInTheDocument()
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
    for(const range of ['1M','2M','6M','1Y','2Y','5Y','10Y','YTD'])expect(screen.getByRole('button',{name:range})).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button',{name:'Open journal entry from 2026-03-12'}))
    expect(await screen.findByDisplayValue('2026-03-12')).toBeInTheDocument()
    expect(screen.getAllByText('Reviewed the annual report')).toHaveLength(2)
    expect(screen.getByRole('tab',{name:'Journal'})).toHaveAttribute('aria-selected','true')
  })

  it('opens the existing edit-security dialog from the top bar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    const edit=await screen.findByRole('button',{name:'Edit security'})
    expect(edit.closest('.page-header')).toBeInTheDocument()
    fireEvent.click(edit)

    expect(screen.getByRole('dialog',{name:'Edit security'})).toBeInTheDocument()
    expect(screen.getByLabelText('Symbol')).toHaveValue('AAPL')
    expect(screen.getByLabelText('Company name')).toHaveValue('Apple Inc.')
  })

  it('puts colored classification chips and their full paths inside the side panel',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NEM',name:'Newmont',currency:'USD'})
    const taxonomy=await repository.addTaxonomy({name:'Asset Allocation',description:'',color:'#4F7CAC'})
    const materials=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Materials',description:'',color:taxonomy.color})
    const metals=await repository.addTag({taxonomyId:taxonomy.id,parentId:materials.id,name:'Precious Metals',description:'',color:taxonomy.color})
    const gold=await repository.addTag({taxonomyId:taxonomy.id,parentId:metals.id,name:'Gold',description:'',color:'#D69E2E'})
    await repository.setAssignedTags(security.id,[gold.id])

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    const tag=await screen.findByText('Asset Allocation: Materials ▸ Precious Metals ▸ Gold')
    const panel=screen.getByRole('complementary',{name:'Security details'})
    expect(panel).toContainElement(tag)
    expect(tag.closest('.security-classification-tag')).toHaveStyle({borderColor:gold.color})
    expect(within(panel).getByRole('heading',{name:'Classifications'})).toBeInTheDocument()
    expect(screen.queryByRole('heading',{name:'Asset Allocation'})).not.toBeInTheDocument()
    expect(document.querySelector('.classification-card')).not.toBeInTheDocument()
  })

  it('shows only topic names for direct and inherited connections and refreshes them after editing tags',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'CSU',name:'Constellation Software',currency:'CAD'})
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const vms=await repository.addTag({taxonomyId:taxonomy.id,parentId:software.id,name:'VMS',description:'',color:taxonomy.color})
    await repository.setAssignedTags(security.id,[vms.id])
    const direct=await repository.addResearchTopic('Direct research')
    const inherited=await repository.addResearchTopic('Inherited research')
    const both=await repository.addResearchTopic('Combined research')
    await repository.addResearchTopic('Unrelated research')
    await repository.setResearchTopicRelations(direct.id,[security.id],[])
    await repository.setResearchTopicRelations(inherited.id,[],[software.id])
    await repository.setResearchTopicRelations(both.id,[security.id],[vms.id])

    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    const context=await screen.findByRole('region',{name:'Security context'})
    await within(context).findByRole('button',{name:'Inherited research'})
    const topics=within(context).getByRole('region',{name:'Research topics'})
    expect(topics).toHaveTextContent(/^Research topicsCombined researchDirect researchInherited research$/)
    expect(within(context).queryByText('Unrelated research')).not.toBeInTheDocument()

    fireEvent.click(within(context).getByRole('button',{name:'Edit classifications'}))
    const dialog=await screen.findByRole('dialog',{name:'Assign classifications'})
    const checkbox=await within(dialog).findByRole('checkbox',{name:'VMS'})
    await waitFor(()=>expect(checkbox).toBeChecked())
    fireEvent.click(checkbox)
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(within(context).queryByRole('button',{name:'Inherited research'})).not.toBeInTheDocument())
    expect(within(context).getByText('No tags assigned')).toBeInTheDocument()
    expect(within(context).getByRole('button',{name:'Combined research'})).toBeInTheDocument()
    expect(topics).toHaveTextContent(/^Research topicsCombined researchDirect research$/)
  })

  it('opens a related topic and returns to the security with the Back button',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'CSU',name:'Constellation Software',currency:'CAD'})
    const topic=await repository.addResearchTopic('Serial acquirers')
    await repository.setResearchTopicRelations(topic.id,[security.id],[])
    render(<AppProvider repository={repository}><SecurityTopicNavigation securityId={security.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Open security'}))
    fireEvent.click(await screen.findByRole('button',{name:'Serial acquirers'}))
    expect(await screen.findByRole('heading',{name:'Serial acquirers'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Back'}))
    expect(await screen.findByRole('heading',{name:'CSU'})).toBeInTheDocument()
    expect(await screen.findByRole('button',{name:'Serial acquirers'})).toBeInTheDocument()
  })

  it('expands long classification and topic lists independently and resets when changing security',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'CSU',name:'Constellation Software',currency:'CAD'})
    const other=await repository.addSecurity({symbol:'DSG',name:'Descartes',currency:'CAD'})
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const tags=[]
    for(let index=1;index<=5;index++){
      tags.push(await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:`Tag ${index}`,description:'',color:taxonomy.color}))
      const topic=await repository.addResearchTopic(`Topic ${index}`)
      await repository.setResearchTopicRelations(topic.id,[security.id],[])
    }
    await repository.setAssignedTags(security.id,tags.map((tag)=>tag.id))
    const view=render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    const moreTags=await screen.findByRole('button',{name:'Show 2 more classifications'})
    const moreTopics=screen.getByRole('button',{name:'Show 2 more research topics'})
    expect(screen.queryByText('Industry: Tag 5')).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Topic 5'})).not.toBeInTheDocument()
    fireEvent.click(moreTags)
    expect(screen.getByText('Industry: Tag 5')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Topic 5'})).not.toBeInTheDocument()
    fireEvent.click(moreTopics)
    expect(screen.getByRole('button',{name:'Topic 5'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Show fewer research topics'}))
    expect(screen.queryByRole('button',{name:'Topic 5'})).not.toBeInTheDocument()

    view.rerender(<AppProvider repository={repository}><SecurityDetailView id={other.id}/></AppProvider>)
    expect(await screen.findByText('No related topics')).toBeInTheDocument()
    expect(screen.getByText('No tags assigned')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Topic 1'})).not.toBeInTheDocument()
  })

  it('lists, searches, and edits managed PDF metadata in the Documents tab',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'NESN',name:'Nestlé',currency:'CHF'})
    await repository.addSecurityDocument({id:'doc-1',securityId:security.id,title:'UBS initiation report',originalFilename:'ubs-initiation.pdf',storagePath:`attachments/securities/${security.id}/doc-1.pdf`,source:'UBS',documentDate:'2026-06-30',mimeType:'application/pdf',fileSize:2_500_000,sha256:'hash-1'})
    await repository.addSecurityDocument({id:'doc-2',securityId:security.id,title:'Quarterly update',originalFilename:'quarterly.pdf',storagePath:`attachments/securities/${security.id}/doc-2.pdf`,source:'ZKB',documentDate:'2026-08-01',mimeType:'application/pdf',fileSize:400_000,sha256:'hash-2'})
    render(<AppProvider repository={repository}><SecurityDetailView id={security.id}/></AppProvider>)

    fireEvent.click(await screen.findByRole('tab',{name:'Documents (2)'}))
    expect(await screen.findByText('UBS initiation report')).toBeInTheDocument()
    expect(screen.getByText('Quarterly update')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox',{name:'Search documents'}),{target:{value:'UBS'}})
    expect(screen.getByText('UBS initiation report')).toBeInTheDocument()
    expect(screen.queryByText('Quarterly update')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button',{name:'Edit UBS initiation report'}))
    const dialog=screen.getByRole('dialog',{name:'Edit document details'})
    expect(within(dialog).queryByLabelText('Document type')).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Title'),{target:{value:'Updated bank report'}})
    fireEvent.change(within(dialog).getByLabelText(/^Source/),{target:{value:'UBS Research'}})
    fireEvent.click(within(dialog).getByRole('button',{name:'Save'}))

    await waitFor(()=>expect(screen.getByText('Updated bank report')).toBeInTheDocument())
    expect((await repository.listSecurityDocuments(security.id)).find((document)=>document.id==='doc-1')).toEqual(expect.objectContaining({title:'Updated bank report',source:'UBS Research'}))
  })
})
