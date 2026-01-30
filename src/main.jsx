import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { ErrorBoundary } from './App.jsx'
import './globals.css'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
