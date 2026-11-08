import { useEffect, useState } from 'react'
import { Button, Callout, HTMLSelect, InputGroup } from '@blueprintjs/core'
import { useApp } from '../app/AppContext'
import type { ChecklistAnswer, ChecklistQuestion, SecurityChecklistAnswer } from '../domain/types'

export function ChecklistQuestionEditor({questions,onChange}:{questions:ChecklistQuestion[];onChange:(questions:ChecklistQuestion[])=>void}) {
  const move=(index:number,offset:number)=>{const next=[...questions];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next)}
  return <section><h2>Investment checklist</h2><p className="muted">Questions apply to every company. New questions start unanswered. Editing keeps existing answers; deleting a question removes its answers when you save.</p>
    {questions.map((q,index)=><div className="checklist-question-editor" key={q.id}><InputGroup aria-label={`Question ${index+1}`} value={q.question} placeholder="Enter an investment question" onChange={e=>onChange(questions.map(item=>item.id===q.id?{...item,question:e.target.value}:item))}/><Button icon="arrow-up" aria-label={`Move question ${index+1} up`} disabled={index===0} onClick={()=>move(index,-1)}/><Button icon="arrow-down" aria-label={`Move question ${index+1} down`} disabled={index===questions.length-1} onClick={()=>move(index,1)}/><Button icon="trash" intent="danger" aria-label={`Remove question ${index+1}`} onClick={()=>onChange(questions.filter(item=>item.id!==q.id))}/></div>)}
    <Button icon="add" text="Add question" onClick={()=>onChange([...questions,{id:crypto.randomUUID(),question:'',sortOrder:questions.length}])}/>
  </section>
}

export function InvestmentChecklist({securityId}:{securityId:string}) {
  const {repository,securityLinkTemplates}=useApp()
  const [questions,setQuestions]=useState<ChecklistQuestion[]>([])
  const [answers,setAnswers]=useState<SecurityChecklistAnswer[]>([])
  const [loaded,setLoaded]=useState(false)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  useEffect(()=>{let active=true;setLoaded(false);setError('');Promise.all([repository.listChecklistQuestions(),repository.listChecklistAnswers(securityId)]).then(([q,a])=>{if(active){setQuestions(q);setAnswers(a);setLoaded(true)}}).catch(reason=>{if(active)setError(String(reason))});return()=>{active=false}},[repository,securityId,securityLinkTemplates])
  const save=async(questionId:string,value:string)=>{setSaving(true);setError('');try{const answer=value?(value as ChecklistAnswer):null;await repository.setChecklistAnswer(securityId,questionId,answer);setAnswers(current=>[...current.filter(a=>a.questionId!==questionId),...(answer?[{securityId,questionId,answer}]:[])])}catch(reason){setError(String(reason))}finally{setSaving(false)}}
  return <div className="investment-checklist">{error&&<Callout intent="danger">{error}</Callout>}{!loaded?<p>{error?'Could not load checklist.':'Loading checklist…'}</p>:!questions.length?<p className="muted">No investment questions yet. Add them in Settings → Investment checklist.</p>:<><p className="muted">{answers.length} of {questions.length} answered. Answers save automatically.</p>{questions.map(q=><label className="checklist-answer-row" key={q.id}><span>{q.question}</span><HTMLSelect aria-label={q.question} disabled={saving} value={answers.find(a=>a.questionId===q.id)?.answer??''} onChange={e=>void save(q.id,e.target.value)} options={[{value:'',label:'Unanswered'},{value:'yes',label:'Yes'},{value:'no',label:'No'},{value:'na',label:'n/a'}]}/></label>)}</>}</div>
}
