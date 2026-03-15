import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { OllamaProvider } from './context/OllamaContext'
import { OpenClawProvider } from './context/OpenClawContext'
import { ToolApprovalProvider } from './context/ToolApprovalContext'
import App from './App.jsx'
import './App.css'
import './ApprovalPolicy.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <OllamaProvider>
      <OpenClawProvider>
        <ToolApprovalProvider>
          <App />
        </ToolApprovalProvider>
      </OpenClawProvider>
    </OllamaProvider>
  </HashRouter>
)
