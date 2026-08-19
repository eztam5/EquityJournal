import { useEffect, useState } from 'react'
import { Button, HTMLTable } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { ResearchTopic } from '../domain/types'
import { ConfirmDialog, ResearchTopicForm } from './Forms'

type TopicRow={topic:ResearchTopic;relatedCount:number}

function displayDate(value:string){return new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value))}

export function ResearchTopicsView() {
  const app=useApp();const[rows,setRows]=useState<TopicRow[]>([]);const[creating,setCreating]=useState(false);const[editing,setEditing]=useState<ResearchTopic>();const[deleting,setDeleting]=useState<ResearchTopic>()
  useEffect(()=>{let active=true;Promise.all(app.researchTopics.map(async(topic)=>({topic,relatedCount:(await app.repository.getResearchTopicRelations(topic.id)).relatedSecurities.length}))).then((next)=>{if(active)setRows(next)});return()=>{active=false}},[app.repository,app.researchTopics])
  return <main className="content page"><header className="page-header"><div><h1>Research Topics</h1><p>Develop research that spans companies, themes, sectors, and strategies.</p></div><Button icon="add" intent="primary" text="New topic" onClick={()=>setCreating(true)}/></header><div className="content-panel data-card"><HTMLTable className="security-table topic-table" compact interactive striped><thead><tr><th>Topic</th><th>Related securities</th><th>Last updated</th><th aria-label="Actions"/></tr></thead><tbody>{rows.map(({topic,relatedCount})=><tr key={topic.id} onDoubleClick={()=>app.openResearchTopic(topic.id)}><td><button className="topic-title-link" onClick={()=>app.openResearchTopic(topic.id)}>{topic.title}</button></td><td>{relatedCount}</td><td>{displayDate(topic.updatedAt)}</td><td><Button variant="minimal" size="small" icon="edit" aria-label={`Edit ${topic.title}`} onClick={()=>setEditing(topic)}/><Button variant="minimal" size="small" icon="trash" intent="danger" aria-label={`Delete ${topic.title}`} onClick={()=>setDeleting(topic)}/></td></tr>)}</tbody></HTMLTable>{rows.length===0&&<div className="empty-state"><p>No research topics yet.</p><Button icon="add" intent="primary" text="Create your first topic" onClick={()=>setCreating(true)}/></div>}</div>{creating&&<ResearchTopicForm onClose={()=>setCreating(false)}/>} {editing&&<ResearchTopicForm topic={editing} onClose={()=>setEditing(undefined)}/>} {deleting&&<ConfirmDialog title="Delete research topic" message={`Delete “${deleting.title}” and all of its research notes? Securities and tags will not be deleted.`} confirmLabel="Delete" onClose={()=>setDeleting(undefined)} onConfirm={()=>app.deleteResearchTopic(deleting.id)}/>}</main>
}
