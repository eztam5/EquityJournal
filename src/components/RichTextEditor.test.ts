import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { filterInternalReferences, InternalReference } from './RichTextEditor'

describe('internal note references',()=>{
  let editor:Editor|undefined
  afterEach(()=>editor?.destroy())

  it('stores the stable entity type and id in note HTML',()=>{
    editor=new Editor({extensions:[StarterKit,InternalReference],content:{type:'doc',content:[{type:'paragraph',content:[{type:'internalReference',attrs:{referenceType:'security',referenceId:'security-1',label:'AAPL — Apple Inc.'}}]}]}})

    expect(editor.getHTML()).toContain('data-reference-type="security"')
    expect(editor.getHTML()).toContain('data-reference-id="security-1"')
    expect(editor.getText()).toContain('AAPL — Apple Inc.')
  })

  it('searches reference labels and metadata case-insensitively',()=>{
    const items=[
      {type:'security' as const,id:'security-1',label:'AAPL — Apple Inc.',searchText:'AAPL Apple Inc. US0378331005'},
      {type:'topic' as const,id:'topic-1',label:'Serial acquirers',searchText:'Serial acquirers'},
    ]

    expect(filterInternalReferences(items,'apple')).toEqual([items[0]])
    expect(filterInternalReferences(items,'SERIAL')).toEqual([items[1]])
  })
})
