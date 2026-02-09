import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { ErrorBoundary } from './App.jsx'
import './globals.css'
import { AuthProvider } from './context/AuthContext.jsx'

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e) {
  console.error("FATAL INITIALIZATION ERROR:", e);
  rootElement.innerHTML = `<div style="color: red; padding: 20px;">
    <h1>Error Crítico de Inicialización</h1>
    <pre>${e.message}</pre>
    <p>Por favor, revisa la consola del navegador para más detalles.</p>
  </div>`;
}
