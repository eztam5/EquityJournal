import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { RichTextEditor } from './RichTextEditor'

const imageMocks=vi.hoisted(()=>({pick:vi.fn(),store:vi.fn(),resolve:vi.fn()}))
vi.mock('../utils/editorImageStorage',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('../utils/editorImageStorage')>()
  return{...actual,pickEditorImageSources:imageMocks.pick,storeEditorImage:imageMocks.store,createEditorImageObjectUrl:imageMocks.resolve}
})

describe('RichTextEditor managed images',()=>{
  afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks()})

  it('inserts a managed image selected from the toolbar',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const security=await repository.addSecurity({symbol:'AAPL',name:'Apple Inc.',currency:'USD'})
    const file=new File([new Uint8Array([1])],'revenue_chart.png',{type:'image/png'}),onChange=vi.fn()
    imageMocks.pick.mockResolvedValue([{kind:'file',file}])
    imageMocks.store.mockResolvedValue({id:'image-1',ownerType:'security',ownerId:security.id,originalFilename:file.name,storagePath:'securities/image.png',mimeType:'image/png',fileSize:1,sha256:'hash',orphanedAt:null,createdAt:'',updatedAt:''})
    imageMocks.resolve.mockResolvedValue({url:'blob:managed-image',release:vi.fn()})
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Research</p>" onChange={onChange} imageContext={{ownerType:'security',ownerId:security.id,contentType:'security-note',contentId:security.id}}/></AppProvider>)

    fireEvent.click(await screen.findByRole('button',{name:'Insert image'}))

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('data-equity-journal-image-id="image-1"')
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('alt="revenue chart"')
  })

  it('uses the same managed pipeline for pasted images',async()=>{
    const repository=new LocalRepository();await repository.initialize()
    const topic=await repository.addResearchTopic('Pricing power'),onChange=vi.fn(),file=new File([new Uint8Array([1])],'screenshot.png',{type:'image/png'})
    imageMocks.store.mockResolvedValue({id:'image-2',ownerType:'topic',ownerId:topic.id,originalFilename:file.name,storagePath:'topics/image.png',mimeType:'image/png',fileSize:1,sha256:'hash',orphanedAt:null,createdAt:'',updatedAt:''})
    imageMocks.resolve.mockResolvedValue({url:'blob:managed-image',release:vi.fn()})
    render(<AppProvider repository={repository}><RichTextEditor content="<p>Research</p>" onChange={onChange} imageContext={{ownerType:'topic',ownerId:topic.id,contentType:'topic-note',contentId:topic.id}}/></AppProvider>)

    fireEvent.paste(document.querySelector('.rich-editor')!,{clipboardData:{files:[file],getData:()=>''}})

    await waitFor(()=>expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('data-equity-journal-image-id="image-2"')
  })
})
