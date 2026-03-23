import React, { useState, useEffect } from 'react'
import { useOllama } from '../context/OllamaContext'
import { useWorkflowContext } from '../context/WorkflowContext'

const OPENCLAW_AGENTS = ['btc-chief','btc-price-desk','btc-catalyst-desk','btc-macro-desk','btc-opportunity-ranker-desk']
const STEP_TYPES = ['shell', 'ai', 'condition', 'notify']

function StepStatusIcon({ status }) {
  if (status === 'waiting') return <span>⏸</span>
  if (status === 'running') return <span className="spin">⏳</span>
  if (status === 'done') return <span>✅</span>
  if (status === 'error') return <span>❌</span>
  return <span>○</span>
}

function StepEditor({ step, index, onChange, onDelete, onMoveUp, onMoveDown }) {
  const set = (k, v) => onChange(index, { ...step, [k]: v })
  return (
    <div className="workflow-step-editor">
      <div className="step-editor-header">
        <span className="step-number">Step {index + 1}</span>
        <select className="text-input" style={{ width: 120 }} value={step.type} onChange={e => set('type', e.target.value)}>
          {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="step-editor-actions">
          <button className="btn-ghost btn-xs" onClick={() => onMoveUp(index)} disabled={index === 0}>↑</button>
          <button className="btn-ghost btn-xs" onClick={() => onMoveDown(index)}>↓</button>
          <button className="btn-ghost btn-xs" onClick={() => onDelete(index)}>🗑</button>
        </div>
      </div>
      <div className="step-editor-fields">
        {step.type === 'shell' && (
          <div className="form-field">
            <label className="form-label">PowerShell Command</label>
            <textarea className="text-input" rows={2} value={step.command || ''} onChange={e => set('command', e.target.value)} placeholder="Get-Date   or   {{PREV_OUTPUT}}" />
          </div>
        )}
        {step.type === 'ai' && (
          <>
            <div className="form-field">
              <label className="form-label">Agent / Model</label>
              <select className="text-input" value={step.agentId || ''} onChange={e => set('agentId', e.target.value)}>
                <option value="">-- Ollama model --</option>
                {OPENCLAW_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Prompt</label>
              <textarea className="text-input" rows={3} value={step.prompt || ''} onChange={e => set('prompt', e.target.value)} placeholder="Use {{PREV_OUTPUT}} or {{STEP_0_OUTPUT}}" />
            </div>
          </>
        )}
        {step.type === 'condition' && (
          <>
            <div className="form-field">
              <label className="form-label">Regex Pattern (tests previous output)</label>
              <input className="text-input" value={step.pattern || ''} onChange={e => set('pattern', e.target.value)} placeholder="bullish|score: [7-9]" />
            </div>
            <div className="form-field">
              <label className="form-label">If match → go to step #</label>
              <input className="text-input" type="number" value={step.branchTo ?? ''} onChange={e => set('branchTo', Number(e.target.value))} placeholder="Step index (0-based)" />
            </div>
            <div className="form-field">
              <label className="form-label">If no match → go to step #</label>
              <input className="text-input" type="number" value={step.elseBranchTo ?? ''} onChange={e => set('elseBranchTo', Number(e.target.value))} />
            </div>
          </>
        )}
        {step.type === 'notify' && (
          <>
            <div className="form-field">
              <label className="form-label">Title</label>
              <input className="text-input" value={step.title || ''} onChange={e => set('title', e.target.value)} placeholder="Notification title" />
            </div>
            <div className="form-field">
              <label className="form-label">Body</label>
              <input className="text-input" value={step.body || ''} onChange={e => set('body', e.target.value)} placeholder="Use {{PREV_OUTPUT}}" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RunnerPanel({ workflow, stepStatuses, onAbort, running }) {
  const steps = workflow.steps || []
  return (
    <div className="runner-panel">
      <div className="runner-header">
        <span>▶ Running: {workflow.name}</span>
        {running && <button className="btn-secondary btn-sm" onClick={onAbort}>⏹ Abort</button>}
      </div>
      {steps.map((step, i) => {
        const st = stepStatuses[i] || { status: 'waiting' }
        return (
          <div key={i} className={`runner-step runner-step--${st.status}`}>
            <div className="runner-step-header">
              <StepStatusIcon status={st.status} />
              <span>Step {i + 1}: {step.type}</span>
              {st.duration != null && <span className="runner-duration">{(st.duration / 1000).toFixed(1)}s</span>}
            </div>
            {(st.chunk || st.output) && (
              <pre className="runner-output">{st.output || st.chunk}</pre>
            )}
            {st.error && <div className="runner-error">{st.error}</div>}
          </div>
        )
      })}
    </div>
  )
}

const EMPTY_WORKFLOW = { name: '', description: '', steps: [] }

export default function WorkflowBuilder() {
  const { models } = useOllama()
  const { workflows, running, stepStatuses, load, save, remove, runWorkflow, abort } = useWorkflowContext()
  const [editing, setEditing] = useState(null) // workflow being edited
  const [runningWorkflow, setRunningWorkflow] = useState(null)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  useEffect(() => { load() }, [load])

  const handleNew = () => setEditing({ ...EMPTY_WORKFLOW, id: null })

  const handleEdit = (wf) => setEditing(JSON.parse(JSON.stringify(wf))) // deep copy

  const handleSave = async () => {
    if (!editing.name) { showToast('⚠️ Please enter a workflow name'); return }
    const saved = await save(editing)
    setEditing(null)
    showToast('✅ Workflow saved')
  }

  const handleRun = (wf) => {
    setRunningWorkflow(wf)
    runWorkflow(wf.id, wf.steps)
  }

  const addStep = () => setEditing(prev => ({ ...prev, steps: [...(prev.steps || []), { type: 'shell', command: '' }] }))

  const updateStep = (index, step) => setEditing(prev => {
    const steps = [...prev.steps]; steps[index] = step; return { ...prev, steps }
  })

  const deleteStep = (index) => setEditing(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }))

  const moveStepUp = (index) => {
    if (index === 0) return
    setEditing(prev => {
      const steps = [...prev.steps]
      ;[steps[index - 1], steps[index]] = [steps[index], steps[index - 1]]
      return { ...prev, steps }
    })
  }

  const moveStepDown = (index) => setEditing(prev => {
    if (index >= prev.steps.length - 1) return prev
    const steps = [...prev.steps]
    ;[steps[index], steps[index + 1]] = [steps[index + 1], steps[index]]
    return { ...prev, steps }
  })

  if (runningWorkflow) {
    return (
      <div className="page workflow-page">
        <div className="page-header">
          <h1 className="page-title">🔗 Workflow Runner</h1>
          <button className="btn-secondary btn-sm" onClick={() => { setRunningWorkflow(null) }}>← Back</button>
        </div>
        <RunnerPanel
          workflow={runningWorkflow}
          stepStatuses={stepStatuses}
          running={running === runningWorkflow.id}
          onAbort={() => abort(runningWorkflow.id)}
        />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="page workflow-page">
        <div className="page-header">
          <h1 className="page-title">🔗 {editing.id ? 'Edit' : 'New'} Workflow</h1>
          <div className="page-actions">
            <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>← Cancel</button>
            <button className="btn-primary btn-sm" onClick={handleSave}>💾 Save</button>
          </div>
        </div>
        {toastMsg && <div className="toast">{toastMsg}</div>}
        <div className="section">
          <div className="form-field">
            <label className="form-label">Workflow Name</label>
            <input className="text-input" value={editing.name} onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Morning BTC Brief" />
          </div>
          <div className="form-field">
            <label className="form-label">Description</label>
            <input className="text-input" value={editing.description || ''} onChange={e => setEditing(prev => ({ ...prev, description: e.target.value }))} placeholder="What does this workflow do?" />
          </div>
        </div>
        <div className="section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Steps ({(editing.steps || []).length})</h2>
            <button className="btn-secondary btn-sm" onClick={addStep}>+ Add Step</button>
          </div>
          {(editing.steps || []).length === 0 && <div className="empty-state">No steps yet. Add a step to build your workflow.</div>}
          {(editing.steps || []).map((step, i) => (
            <StepEditor key={i} step={step} index={i} onChange={updateStep} onDelete={deleteStep} onMoveUp={moveStepUp} onMoveDown={moveStepDown} />
          ))}
        </div>
        <div style={{ margin: '8px 0 24px' }}>
          <button className="btn-primary" onClick={handleSave}>💾 Save Workflow</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page workflow-page">
      <div className="page-header">
        <h1 className="page-title">🔗 Workflow Builder</h1>
        <div className="page-actions">
          <button className="btn-primary btn-sm" onClick={handleNew}>+ New Workflow</button>
        </div>
      </div>
      {toastMsg && <div className="toast">{toastMsg}</div>}
      <div className="section">
        {workflows.length === 0 && <div className="empty-state">No workflows yet. Create your first automation workflow!</div>}
        {workflows.map(wf => (
          <div key={wf.id} className="workflow-card">
            <div className="workflow-card-header">
              <div>
                <div className="workflow-name">{wf.name}</div>
                {wf.description && <div className="workflow-desc">{wf.description}</div>}
              </div>
              <div className="workflow-card-actions">
                <button className="btn-primary btn-sm" onClick={() => handleRun(wf)} disabled={running === wf.id}>
                  {running === wf.id ? '⏳' : '▶ Run'}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => handleEdit(wf)}>✏️ Edit</button>
                <button className="btn-ghost btn-sm" onClick={() => remove(wf.id)}>🗑</button>
              </div>
            </div>
            <div className="workflow-steps-preview">
              {(wf.steps || []).map((s, i) => (
                <span key={i} className="workflow-step-chip">{s.type}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
