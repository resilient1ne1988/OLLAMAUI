import React, { useState } from 'react'

export default function CodeBlock({ code, language = '', showLineNumbers = false }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        {language && <span className="code-lang-badge">{language}</span>}
        <button className="btn-icon copy-btn" onClick={copy}>{copied ? '✓' : '📋'}</button>
      </div>
      <pre className="code-block">
        {showLineNumbers
          ? lines.map((line, i) => (
            <div key={i} className="code-line">
              <span className="line-num">{i + 1}</span>
              <span>{line}</span>
            </div>
          ))
          : <code>{code}</code>
        }
      </pre>
    </div>
  )
}
