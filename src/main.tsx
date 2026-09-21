import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { TaskProvider } from './context/TaskContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { initFont } from './lib/fonts'

initFont()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <TaskProvider>
            <App />
          </TaskProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
)
