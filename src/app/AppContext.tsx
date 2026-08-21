import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { createRepository, type EquityRepository } from '../data'
import type { SecurityInput } from '../data/repository'
import type { ResearchTopic, Security, SecurityLinkTemplate, Tag, Taxonomy, ThemeMode, View, Watchlist } from '../domain/types'
import { loadSecurityDisplayMode, SECURITY_DISPLAY_MODE_KEY, type SecurityDisplayMode } from '../utils/securityLabels'
import { removeSecurityDocumentDirectory } from '../utils/securityDocumentStorage'

interface AppContextValue {
  repository: EquityRepository
  ready: boolean
  error: string
  securities: Security[]
  watchlists: Watchlist[]
  taxonomies: Taxonomy[]
  securityLinkTemplates: SecurityLinkTemplate[]
  researchTopics: ResearchTopic[]
  recent: Security[]
  view: View
  canGoBack: boolean
  theme: ThemeMode
  securityDisplayMode: SecurityDisplayMode
  setView(view: View): void
  goBack(): void
  setTheme(theme: ThemeMode): void
  setSecurityDisplayMode(mode: SecurityDisplayMode): void
  openSecurity(id: string): void
  openResearchTopic(id: string): void
  refresh(): Promise<void>
  addSecurity(input: SecurityInput): Promise<Security>
  updateSecurity(input: Security): Promise<void>
  deleteSecurity(id: string): Promise<void>
  addWatchlist(name: string): Promise<void>
  updateWatchlist(watchlist: Watchlist): Promise<void>
  moveWatchlist(id:string,offset:-1|1):Promise<void>
  deleteWatchlist(id: string): Promise<void>
  addTaxonomy(input: Pick<Taxonomy, 'name' | 'description' | 'color'>): Promise<void>
  deleteTaxonomy(id: string): Promise<void>
  addResearchTopic(title: string): Promise<ResearchTopic>
  updateResearchTopic(topic: Pick<ResearchTopic, 'id' | 'title'>): Promise<void>
  deleteResearchTopic(id: string): Promise<void>
  listTags(taxonomyId: string): Promise<Tag[]>
}

const Context = createContext<AppContextValue | null>(null)
const THEME_KEY = 'equity-journal.theme'
const RECENT_KEY = 'equity-journal.recent-securities'
type NavigationState={view:View;history:View[]}
type NavigationAction={type:'navigate';view:View}|{type:'replace';view:View}|{type:'back'}
const sameView=(left:View,right:View)=>left.type===right.type&&(!('id'in left)||!('id'in right)||left.id===right.id)
export function navigationReducer(state:NavigationState,action:NavigationAction):NavigationState {
  if(action.type==='back'){const previous=state.history.at(-1);return previous?{view:previous,history:state.history.slice(0,-1)}:state}
  if(sameView(state.view,action.view))return state
  return action.type==='replace'?{...state,view:action.view}:{view:action.view,history:[...state.history,state.view].slice(-50)}
}

export function AppProvider({ children, repository: suppliedRepository }: { children: ReactNode; repository?: EquityRepository }) {
  const [repository] = useState(() => suppliedRepository ?? createRepository())
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [securities, setSecurities] = useState<Security[]>([])
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([])
  const [securityLinkTemplates, setSecurityLinkTemplates] = useState<SecurityLinkTemplate[]>([])
  const [researchTopics, setResearchTopics] = useState<ResearchTopic[]>([])
  const [navigation, dispatchNavigation] = useReducer(navigationReducer,{view:{type:'all-securities'},history:[]})
  const view=navigation.view
  const setView=useCallback((next:View)=>dispatchNavigation({type:'navigate',view:next}),[])
  const replaceView=useCallback((next:View)=>dispatchNavigation({type:'replace',view:next}),[])
  const goBack=useCallback(()=>dispatchNavigation({type:'back'}),[])
  const [theme, setThemeState] = useState<ThemeMode>(() => (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'dark')
  const [securityDisplayMode, setSecurityDisplayModeState] = useState<SecurityDisplayMode>(loadSecurityDisplayMode)
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') }
    catch { return [] }
  })

  const refresh = useCallback(async () => {
    const [nextSecurities, nextWatchlists, nextTaxonomies, nextSecurityLinkTemplates, nextResearchTopics] = await Promise.all([
      repository.listSecurities(), repository.listWatchlists(), repository.listTaxonomies(), repository.listSecurityLinkTemplates(), repository.listResearchTopics(),
    ])
    setSecurities(nextSecurities); setWatchlists(nextWatchlists); setTaxonomies(nextTaxonomies); setSecurityLinkTemplates(nextSecurityLinkTemplates);setResearchTopics(nextResearchTopics)
    setRecentIds((ids) => ids.filter((id) => nextSecurities.some((security) => security.id === id)).slice(0, 5))
  }, [repository])

  useEffect(() => {
    repository.initialize().then(refresh).then(() => setReady(true)).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [refresh, repository])

  useEffect(() => {
    const actual = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    document.documentElement.dataset.theme = actual
    document.documentElement.style.colorScheme = actual
    document.documentElement.classList.toggle('bp6-dark', actual === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds)) }, [recentIds])
  useEffect(() => { localStorage.setItem(SECURITY_DISPLAY_MODE_KEY, securityDisplayMode) }, [securityDisplayMode])

  const setTheme = (next: ThemeMode) => setThemeState(next)
  const setSecurityDisplayMode = (next: SecurityDisplayMode) => setSecurityDisplayModeState(next)
  const openSecurity = (id: string) => {
    if (!securities.some((security) => security.id === id)) return
    setRecentIds((ids) => [id, ...ids.filter((value) => value !== id)].slice(0, 5))
    setView({ type: 'security', id })
  }
  const openResearchTopic = (id: string) => { if(researchTopics.some((topic)=>topic.id===id))setView({type:'topic',id}) }
  const addSecurity = async (input: SecurityInput) => { const result = await repository.addSecurity(input); await refresh(); return result }
  const updateSecurity = async (input: Security) => { await repository.updateSecurity(input); await refresh() }
  const deleteSecurity = async (id: string) => {
    await repository.deleteSecurity(id); await removeSecurityDocumentDirectory(id).catch(()=>{}); setRecentIds((ids) => ids.filter((value) => value !== id))
    if (view.type === 'security' && view.id === id) replaceView({ type: 'all-securities' })
    await refresh()
  }
  const addWatchlist = async (name: string) => { await repository.addWatchlist(name); await refresh() }
  const updateWatchlist = async (watchlist: Watchlist) => { await repository.updateWatchlist(watchlist); await refresh() }
  const moveWatchlist=async(id:string,offset:-1|1)=>{await repository.moveWatchlist(id,offset);await refresh()}
  const deleteWatchlist = async (id: string) => {
    await repository.deleteWatchlist(id)
    if (view.type === 'watchlist' && view.id === id) replaceView({ type: 'all-securities' })
    await refresh()
  }
  const addTaxonomy = async (input: Pick<Taxonomy, 'name' | 'description' | 'color'>) => { await repository.addTaxonomy(input); await refresh() }
  const deleteTaxonomy = async (id: string) => {
    await repository.deleteTaxonomy(id)
    if (view.type === 'taxonomy' && view.id === id) replaceView({ type: 'all-securities' })
    await refresh()
  }
  const addResearchTopic=async(title:string)=>{const result=await repository.addResearchTopic(title);await refresh();setView({type:'topic',id:result.id});return result}
  const updateResearchTopic=async(topic:Pick<ResearchTopic,'id'|'title'>)=>{await repository.updateResearchTopic(topic);await refresh()}
  const deleteResearchTopic=async(id:string)=>{await repository.deleteResearchTopic(id);if(view.type==='topic'&&view.id===id)replaceView({type:'topics'});await refresh()}

  const recent = recentIds.map((id) => securities.find((security) => security.id === id)).filter((value): value is Security => Boolean(value))
  const value = useMemo<AppContextValue>(() => ({ repository, ready, error, securities, watchlists, taxonomies, securityLinkTemplates, researchTopics, recent, view, canGoBack:navigation.history.length>0, theme, securityDisplayMode, setView, goBack, setTheme, setSecurityDisplayMode, openSecurity, openResearchTopic, refresh, addSecurity, updateSecurity, deleteSecurity, addWatchlist, updateWatchlist, moveWatchlist, deleteWatchlist, addTaxonomy, deleteTaxonomy, addResearchTopic, updateResearchTopic, deleteResearchTopic, listTags: (id) => repository.listTags(id) }), [repository, ready, error, securities, watchlists, taxonomies, securityLinkTemplates, researchTopics, recent, view, navigation.history.length, theme, securityDisplayMode, setView, goBack, refresh])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useApp() {
  const context = useContext(Context)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
