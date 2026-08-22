import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { ResearchTopicDetailView } from './ResearchTopicDetailView'
import { ResearchTopicsView } from './ResearchTopicsView'

describe('Research topics',()=>{
  afterEach(()=>{cleanup();localStorage.clear()})

  it('creates a topic from the overview',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    render(<AppProvider repository={repository}><ResearchTopicsView/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'New topic'}))
    fireEvent.change(screen.getByLabelText('Topic title'),{target:{value:'Serial acquirers in VMS'}})
    fireEvent.click(within(screen.getByRole('dialog',{name:'New research topic'})).getByRole('button',{name:'Save'}))

    await waitFor(async()=>expect((await repository.listResearchTopics()).map((topic)=>topic.title)).toEqual(['Serial acquirers in VMS']))
  })

  it('searches research topics by title and clears the search',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    await repository.addResearchTopic('Pricing power in luxury goods')
    await repository.addResearchTopic('Serial acquirers in VMS')
    render(<AppProvider repository={repository}><ResearchTopicsView/></AppProvider>)

    const search=await screen.findByRole('searchbox',{name:'Search research topics'})
    expect(await screen.findByText('Pricing power in luxury goods')).toBeInTheDocument()
    expect(screen.getByText('Serial acquirers in VMS')).toBeInTheDocument()

    fireEvent.change(search,{target:{value:'pricing'}})
    expect(screen.getByText('Pricing power in luxury goods')).toBeInTheDocument()
    expect(screen.queryByText('Serial acquirers in VMS')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2 research topics')).toBeInTheDocument()

    fireEvent.change(search,{target:{value:'missing'}})
    expect(screen.getByText('No research topics match “missing”.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Clear search'}))
    expect(screen.getByText('Serial acquirers in VMS')).toBeInTheDocument()
  })

  it('shows direct and dynamically included securities with the selected tag rule',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const vms=await repository.addTag({taxonomyId:taxonomy.id,parentId:software.id,name:'VMS',description:'',color:taxonomy.color})
    const constellation=await repository.addSecurity({symbol:'CSU',name:'Constellation Software',currency:'CAD'})
    const descartes=await repository.addSecurity({symbol:'DSG',name:'Descartes Systems',currency:'CAD'})
    await repository.setAssignedTags(constellation.id,[vms.id])
    await repository.setAssignedTags(descartes.id,[vms.id])
    const topic=await repository.addResearchTopic('Serial acquirers in VMS')
    await repository.setResearchTopicRelations(topic.id,[constellation.id],[software.id])

    render(<AppProvider repository={repository}><ResearchTopicDetailView id={topic.id}/></AppProvider>)

    expect(await screen.findByText('Serial acquirers in VMS')).toBeInTheDocument()
    expect(await screen.findByRole('button',{name:'CSU — Constellation Software'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'DSG — Descartes Systems'})).toBeInTheDocument()
    expect(screen.getByText('Both').closest('.topic-inclusion-tag')).toHaveAttribute('title','Individual and classification')
    expect(screen.getByText('Tag').closest('.topic-inclusion-tag')).toHaveAttribute('title','Classification tag')
    expect(screen.getByLabelText('2 securities')).toBeInTheDocument()
    expect(screen.getByRole('list',{name:'Related securities'})).toBeInTheDocument()
    expect(document.querySelector('.topic-rule-list')).toHaveTextContent('Industry: Software')
    expect(document.querySelector('.topic-rule-list')).not.toHaveTextContent('+ children')

    fireEvent.click(screen.getByRole('button',{name:'Manage'}))
    const dialog=await screen.findByRole('dialog',{name:'Manage related securities'})
    expect(within(dialog).getByLabelText('CSU — Constellation Software')).toBeChecked()
    expect(within(dialog).getByLabelText('Software')).toBeChecked()
  })

  it('uses the save button itself to show the current thesis save state',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const topic=await repository.addResearchTopic('Serial acquirers in VMS')
    await repository.saveResearchTopicNote(topic.id,'<p>Initial thesis</p>')

    render(<AppProvider repository={repository}><ResearchTopicDetailView id={topic.id}/></AppProvider>)

    const saveButton=await screen.findByRole('button',{name:'Saved'})
    const tabList=screen.getByRole('tablist')
    expect(saveButton.compareDocumentPosition(tabList)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(saveButton.closest('.research-save-controls')).toBeInTheDocument()
    expect(document.querySelector('.notes-card > header > span')).not.toBeInTheDocument()

    fireEvent.click(saveButton)
    expect(await screen.findByRole('button',{name:'Saved'})).toBeInTheDocument()
    expect(await repository.loadResearchTopicNote(topic.id)).toEqual(expect.objectContaining({contentHtml:'<p>Initial thesis</p>'}))
  })
})
