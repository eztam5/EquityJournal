import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCopyModifierPressed, useTaxonomyDragAndDrop, type TaxonomyDropOperation } from './useTaxonomyDragAndDrop'

function Harness({ onDrop }: { onDrop(operation: TaxonomyDropOperation): void }) {
  const drag=useTaxonomyDragAndDrop(onDrop)
  return <div data-testid="tree" {...drag.pointerHandlers}>
    <div className="bp6-tree-node-content"><span data-testid="security-icon"/><span className="taxonomy-security-label" data-security-id="security" data-tag-id="source"/></div>
    <div className="bp6-tree-node-content"><span data-testid="source" data-taxonomy-tag-id="source"/></div>
    <div className="bp6-tree-node-content"><span data-testid="target" data-taxonomy-tag-id="target" className={drag.dropTargetId==='target'?'drop-target':''}/></div>
    <output data-testid="mode">{drag.copying?'copy':'move'}</output>
  </div>
}

describe('useTaxonomyDragAndDrop',()=>{
  let point:Element|null=null
  afterEach(()=>{cleanup();point=null;Reflect.deleteProperty(document,'elementFromPoint');document.documentElement.classList.remove('taxonomy-security-dragging','taxonomy-security-copying')})

  const setup=()=>{
    const onDrop=vi.fn()
    Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>point})
    render(<Harness onDrop={onDrop}/>)
    point=screen.getByTestId('target')
    return {onDrop,tree:screen.getByTestId('tree'),icon:screen.getByTestId('security-icon')}
  }

  it('moves an assignment when released over a different tag',()=>{
    const{onDrop,icon}=setup()
    fireEvent.pointerDown(icon,{button:0,pointerId:1})
    fireEvent.pointerMove(icon,{clientX:10,clientY:10,pointerId:1})
    fireEvent.pointerUp(icon,{clientX:10,clientY:10,pointerId:1})
    expect(onDrop).toHaveBeenCalledWith({securityId:'security',fromTagId:'source',toTagId:'target',copy:false})
  })

  it('tracks the platform copy modifier while dragging',async()=>{
    const{onDrop,icon}=setup()
    fireEvent.pointerDown(icon,{button:0,pointerId:1})
    fireEvent.keyDown(document,{key:'Control',ctrlKey:true})
    await waitFor(()=>expect(screen.getByTestId('mode')).toHaveTextContent('copy'))
    expect(document.documentElement).toHaveClass('taxonomy-security-copying')
    fireEvent.pointerUp(icon,{clientX:10,clientY:10,pointerId:1})
    expect(onDrop).toHaveBeenCalledWith({securityId:'security',fromTagId:'source',toTagId:'target',copy:true})
  })

  it('returns to move mode when the copy modifier is released',async()=>{
    const{onDrop,icon}=setup()
    fireEvent.pointerDown(icon,{button:0,pointerId:1})
    fireEvent.keyDown(document,{key:'Control',ctrlKey:true})
    await waitFor(()=>expect(screen.getByTestId('mode')).toHaveTextContent('copy'))
    fireEvent.keyUp(document,{key:'Control',ctrlKey:false})
    await waitFor(()=>expect(screen.getByTestId('mode')).toHaveTextContent('move'))
    fireEvent.pointerUp(icon,{clientX:10,clientY:10,pointerId:1})
    expect(onDrop).toHaveBeenCalledWith({securityId:'security',fromTagId:'source',toTagId:'target',copy:false})
  })

  it('cancels without dropping and clears global feedback',()=>{
    const{onDrop,icon}=setup()
    fireEvent.pointerDown(icon,{button:0,pointerId:1})
    fireEvent.pointerCancel(icon,{pointerId:1})
    expect(onDrop).not.toHaveBeenCalled()
    expect(document.documentElement).not.toHaveClass('taxonomy-security-dragging')
  })

  it('ignores release outside a tag and release on the source tag',()=>{
    const{onDrop,tree,icon}=setup()
    point=null
    fireEvent.pointerDown(icon,{button:0,pointerId:1})
    fireEvent.pointerUp(tree,{clientX:10,clientY:10,pointerId:1})
    point=screen.getByTestId('source')
    fireEvent.pointerDown(icon,{button:0,pointerId:2})
    fireEvent.pointerUp(tree,{clientX:10,clientY:10,pointerId:2})
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('uses Option on macOS and Ctrl elsewhere',()=>{
    expect(isCopyModifierPressed({altKey:true,ctrlKey:false},'MacIntel')).toBe(true)
    expect(isCopyModifierPressed({altKey:false,ctrlKey:true},'MacIntel')).toBe(false)
    expect(isCopyModifierPressed({altKey:false,ctrlKey:true},'Win32')).toBe(true)
  })
})
