import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { OllamaProvider } from './context/OllamaContext'
import { OpenClawProvider } from './context/OpenClawContext'
import { ToolApprovalProvider } from './context/ToolApprovalContext'
import { ChatHistoryProvider } from './context/ChatHistoryContext'
import { ShellHistoryProvider } from './context/ShellHistoryContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { SignalFeedProvider } from './context/SignalFeedContext'
import { WorkflowProvider } from './context/WorkflowContext'
import App from './App.jsx'
import './App.css'
import './ApprovalPolicy.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <SettingsProvider>
      <OllamaProvider>
        <OpenClawProvider>
          <ToolApprovalProvider>
            <ChatHistoryProvider>
              <ShellHistoryProvider>
                <WorkspaceProvider>
                  <SignalFeedProvider>
                    <WorkflowProvider>
                      <App />
                    </WorkflowProvider>
                  </SignalFeedProvider>
                </WorkspaceProvider>
              </ShellHistoryProvider>
            </ChatHistoryProvider>
          </ToolApprovalProvider>
        </OpenClawProvider>
      </OllamaProvider>
    </SettingsProvider>
  </HashRouter>
)