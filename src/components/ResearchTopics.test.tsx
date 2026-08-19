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

  it('shows direct and dynamically included securities with the selected tag rule',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const taxonomy=await repository.addTaxonomy({name:'Industry',description:'',color:'#4F7CAC'})
    const software=await repository.addTag({taxonomyId:taxonomy.id,parentId:null,name:'Software',description:'',color:taxonomy.color})
    const vms=await repository.addTag({taxonomyId:taxonomy.id,parentId:software.id,name:'VMS',description:'',color:taxonomy.color})
    const constellation=await repository.addSecurity({symbol:'CSU',name:'Constellation Software',currency:'CAD'})
    await repository.setAssignedTags(constellation.id,[vms.id])
    const topic=await repository.addResearchTopic('Serial acquirers in VMS')
    await repository.setResearchTopicRelations(topic.id,[constellation.id],[software.id])

    render(<AppProvider repository={repository}><ResearchTopicDetailView id={topic.id}/></AppProvider>)

    expect(await screen.findByText('Serial acquirers in VMS')).toBeInTheDocument()
    expect(await screen.findByRole('button',{name:'CSU — Constellation Software'})).toBeInTheDocument()
    expect(screen.getByText('Individual and classification')).toBeInTheDocument()
    expect(document.querySelector('.topic-rule-list')).toHaveTextContent('Industry: Software')
    expect(document.querySelector('.topic-rule-list')).not.toHaveTextContent('+ children')

    fireEvent.click(screen.getByRole('button',{name:'Manage'}))
    const dialog=await screen.findByRole('dialog',{name:'Manage related securities'})
    expect(within(dialog).getByLabelText('CSU — Constellation Software')).toBeChecked()
    expect(within(dialog).getByLabelText('Software')).toBeChecked()
  })
})
