import { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { TableKit } from '@tiptap/extension-table'
import { Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Outdent, Indent, Link2, Table2, Undo2, Redo2, Rows3, Columns3, Trash2 } from 'lucide-react'

const TEXT_COLORS=['#172033','#F2F4F7','#C25555','#C47F17','#2E8B78','#3478C9','#7A5AF8','#9B5C8F','#667085','#000000','#FFFFFF','#B42318']
const HIGHLIGHTS=['#FFF2A8','#F6C7C7','#FAD8B4','#C7E9D9','#C9DDF5','#DDD1FA','#E4E7EC','#FDE68A','#FECACA','#BBF7D0','#BFDBFE','#E9D5FF']

function Tool({label,active=false,disabled=false,onClick,children}:{label:string;active?:boolean;disabled?:boolean;onClick():void;children:React.ReactNode}){return <button type="button" title={label} aria-label={label} className={`editor-tool ${active?'active':''}`} disabled={disabled} onMouseDown={(e)=>e.preventDefault()} onClick={onClick}>{children}</button>}
function Palette({colors,clear,onSelect}:{colors:string[];clear:string;onSelect(color:string):void}){return <div className="editor-palette popover"><div>{colors.map((color)=><button key={color} style={{background:color}} aria-label={color} onClick={()=>onSelect(color)}/>)}</div><button className="clear-color" onClick={()=>onSelect('')}>{clear}</button></div>}

export function RichTextEditor({content,onChange}:{content:string;onChange(html:string):void}){
  const[colorMenu,setColorMenu]=useState<'text'|'highlight'|null>(null);const[linkOpen,setLinkOpen]=useState(false);const[href,setHref]=useState('');const[tableOpen,setTableOpen]=useState(false)
  const editor=useEditor({extensions:[StarterKit.configure({link:false,underline:false}),Underline,Link.configure({openOnClick:false,autolink:true}),TextStyle,Color,Highlight.configure({multicolor:true}),TableKit.configure({table:{resizable:true}})],content:content||'<p></p>',editorProps:{attributes:{class:'rich-editor','aria-label':'Research notes'}},onUpdate:({editor})=>onChange(editor.getHTML())})
  if(!editor)return null
  const block=editor.isActive('heading',{level:1})?'h1':editor.isActive('heading',{level:2})?'h2':'p'
  const setLink=()=>{if(!href.trim())editor.chain().focus().unsetLink().run();else editor.chain().focus().extendMarkRange('link').setLink({href}).run();setLinkOpen(false)}
  return <div className="editor-shell"><div className="editor-toolbar">
    <div className="tool-group"><Tool label="Undo" disabled={!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}><Undo2/></Tool><Tool label="Redo" disabled={!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}><Redo2/></Tool></div>
    <div className="tool-group"><select aria-label="Paragraph style" value={block} onChange={(e)=>{if(e.target.value==='p')editor.chain().focus().setParagraph().run();else editor.chain().focus().toggleHeading({level:e.target.value==='h1'?1:2}).run()}}><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option></select></div>
    <div className="tool-group"><Tool label="Bold" active={editor.isActive('bold')} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold/></Tool><Tool label="Italic" active={editor.isActive('italic')} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic/></Tool><Tool label="Underline" active={editor.isActive('underline')} onClick={()=>editor.chain().focus().toggleUnderline().run()}><UnderlineIcon/></Tool><Tool label="Strikethrough" active={editor.isActive('strike')} onClick={()=>editor.chain().focus().toggleStrike().run()}><Strikethrough/></Tool>
      <span className="palette-anchor"><Tool label="Text color" onClick={()=>setColorMenu(colorMenu==='text'?null:'text')}><span className="letter-tool">A<i/></span></Tool>{colorMenu==='text'&&<Palette colors={TEXT_COLORS} clear="Automatic" onSelect={(color)=>{color?editor.chain().focus().setColor(color).run():editor.chain().focus().unsetColor().run();setColorMenu(null)}}/>}</span>
      <span className="palette-anchor"><Tool label="Highlight color" active={editor.isActive('highlight')} onClick={()=>setColorMenu(colorMenu==='highlight'?null:'highlight')}><span className="highlight-tool">A</span></Tool>{colorMenu==='highlight'&&<Palette colors={HIGHLIGHTS} clear="No highlight" onSelect={(color)=>{color?editor.chain().focus().setHighlight({color}).run():editor.chain().focus().unsetHighlight().run();setColorMenu(null)}}/>}</span>
    </div>
    <div className="tool-group"><Tool label="Bulleted list" active={editor.isActive('bulletList')} onClick={()=>editor.chain().focus().toggleBulletList().run()}><List/></Tool><Tool label="Numbered list" active={editor.isActive('orderedList')} onClick={()=>editor.chain().focus().toggleOrderedList().run()}><ListOrdered/></Tool><Tool label="Decrease indentation" onClick={()=>editor.chain().focus().liftListItem('listItem').run()}><Outdent/></Tool><Tool label="Increase indentation" onClick={()=>editor.chain().focus().sinkListItem('listItem').run()}><Indent/></Tool></div>
    <div className="tool-group"><span className="palette-anchor"><Tool label="Insert link" active={editor.isActive('link')} onClick={()=>{setHref(editor.getAttributes('link').href??'');setLinkOpen(!linkOpen)}}><Link2/></Tool>{linkOpen&&<div className="link-popover popover"><input autoFocus value={href} onChange={(e)=>setHref(e.target.value)} placeholder="https://example.com" onKeyDown={(e)=>{if(e.key==='Enter')setLink()}}/><button onClick={setLink}>Apply</button></div>}</span><span className="palette-anchor"><Tool label="Insert table" onClick={()=>setTableOpen(!tableOpen)}><Table2/></Tool>{tableOpen&&<div className="table-popover popover"><button onClick={()=>{editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run();setTableOpen(false)}}>Insert 3 × 3 table</button></div>}</span></div>
    {editor.isActive('table')&&<div className="tool-group table-tools"><Tool label="Add row" onClick={()=>editor.chain().focus().addRowAfter().run()}><Rows3/></Tool><Tool label="Delete row" onClick={()=>editor.chain().focus().deleteRow().run()}><Rows3/><small>−</small></Tool><Tool label="Add column" onClick={()=>editor.chain().focus().addColumnAfter().run()}><Columns3/></Tool><Tool label="Delete column" onClick={()=>editor.chain().focus().deleteColumn().run()}><Columns3/><small>−</small></Tool><Tool label="Delete table" onClick={()=>editor.chain().focus().deleteTable().run()}><Trash2/></Tool></div>}
  </div><EditorContent editor={editor}/></div>
}
