import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../styles.css'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'

installRendererDiagnostics('cheat-sheet-preview')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="cheat-sheet-preview">
      <App />
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
