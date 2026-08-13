import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './app/AppContext'
import { App } from './app/App'
import './styles/global.css'
import '@blueprintjs/core/lib/css/blueprint.css'
import './styles/blueprint-overrides.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><AppProvider><App /></AppProvider></StrictMode>,
)
