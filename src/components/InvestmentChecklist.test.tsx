import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AppProvider } from '../app/AppContext'
import { LocalRepository } from '../data/localRepository'
import { InvestmentChecklist } from './InvestmentChecklist'
afterEach(()=>{cleanup();localStorage.clear()})
it('starts unanswered and saves and clears company answers',async()=>{
  const repository=new LocalRepository();await repository.initialize()
  const company=await repository.addSecurity({name:'Apple',symbol:'AAPL',currency:'USD'})
  await repository.saveChecklistQuestions([{id:'q',question:'Profitable?',sortOrder:0}])
  render(<AppProvider repository={repository}><InvestmentChecklist securityId={company.id}/></AppProvider>)
  const select=await screen.findByRole('combobox',{name:'Profitable?'})
  expect(select).toHaveValue('')
  fireEvent.change(select,{target:{value:'yes'}})
  await waitFor(()=>expect(select).toHaveValue('yes'))
  expect((await repository.listChecklistAnswers(company.id))[0].answer).toBe('yes')
  fireEvent.change(select,{target:{value:''}})
  await waitFor(()=>expect(select).toHaveValue(''))
  expect(await repository.listChecklistAnswers(company.id)).toEqual([])
})
