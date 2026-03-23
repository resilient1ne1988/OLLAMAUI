import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import ChatStudio from './pages/ChatStudio'
import ModelRegistry from './pages/ModelRegistry'
import ApiExplorer from './pages/ApiExplorer'
import ApprovalCenter from './pages/ApprovalCenter'
import Terminal from './pages/Terminal'
import Settings from './pages/Settings'
import LearnOllama from './pages/LearnOllama'
import SignalWatcher from './pages/SignalWatcher'
import Arena from './pages/Arena'
import PromptArsenal from './pages/PromptArsenal'
import ConversationIntelligence from './pages/ConversationIntelligence'
import WorkflowBuilder from './pages/WorkflowBuilder'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="chat" element={<ChatStudio />} />
        <Route path="chat-classic" element={<Chat />} />
        <Route path="models" element={<ModelRegistry />} />
        <Route path="api-explorer" element={<ApiExplorer />} />
        <Route path="approvals" element={<ApprovalCenter />} />
        <Route path="terminal" element={<Terminal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="learn" element={<LearnOllama />} />
        <Route path="signals" element={<SignalWatcher />} />
        <Route path="arena" element={<Arena />} />
        <Route path="prompts" element={<PromptArsenal />} />
        <Route path="intelligence" element={<ConversationIntelligence />} />
        <Route path="workflows" element={<WorkflowBuilder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
