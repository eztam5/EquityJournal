import { beforeEach, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'

beforeEach(()=>localStorage.clear())
it('persists independent answers, preserves them on question edits, and cleans up deletions',async()=>{
  const r=new LocalRepository();await r.initialize()
  const a=await r.addSecurity({name:'Apple',symbol:'AAPL',currency:'USD'})
  const b=await r.addSecurity({name:'Microsoft',symbol:'MSFT',currency:'USD'})
  await r.saveChecklistQuestions([{id:'q',question:'Profitable?',sortOrder:0}])
  expect(await r.listChecklistAnswers(a.id)).toEqual([])
  for(const answer of ['yes','no','na'] as const){await r.setChecklistAnswer(a.id,'q',answer);expect((await r.listChecklistAnswers(a.id))[0].answer).toBe(answer)}
  expect(await r.listChecklistAnswers(b.id)).toEqual([])
  await r.saveChecklistQuestions([{id:'q',question:'Consistently profitable?',sortOrder:0},{id:'new',question:'Good management?',sortOrder:1}])
  const next=new LocalRepository();await next.initialize()
  expect(await next.listChecklistAnswers(a.id)).toEqual([{securityId:a.id,questionId:'q',answer:'na'}])
  await next.setChecklistAnswer(a.id,'q',null)
  expect(await next.listChecklistAnswers(a.id)).toEqual([])
  await next.setChecklistAnswer(a.id,'q','yes')
  await next.saveChecklistQuestions([{id:'new',question:'Good management?',sortOrder:0}])
  expect(await next.listChecklistAnswers(a.id)).toEqual([])
  await next.setChecklistAnswer(a.id,'new','no');await next.deleteSecurity(a.id)
  expect(await next.listChecklistAnswers(a.id)).toEqual([])
})
it('rejects blank questions before changing stored questions',async()=>{
  const r=new LocalRepository();await r.initialize()
  await r.saveChecklistQuestions([{id:'q',question:'Valid?',sortOrder:0}])
  await expect(r.saveChecklistQuestions([{id:'q',question:' ',sortOrder:0}])).rejects.toThrow()
  expect((await r.listChecklistQuestions())[0].question).toBe('Valid?')
})
