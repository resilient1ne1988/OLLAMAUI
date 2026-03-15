import React, { useEffect } from 'react'

export default function Toast({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 4000)
    return () => clearTimeout(timer)
  }, [onRemove])

  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      <span className="toast-icon">
        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : 'ℹ️'}
      </span>
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={onRemove}>×</button>
    </div>
  )
}
