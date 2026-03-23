import React from 'react'
import useClaimLedger from '../../hooks/useClaimLedger'
import ClaimCard from './ClaimCard'
import './ClaimLedger.css'

export default function ClaimLedger({ messageId, onRegenerate }) {
  const {
    claims,
    loading,
    filteredClaims,
    filterMode,
    setFilterMode,
  } = useClaimLedger(messageId)

  const allCount = claims.length
  const weakCount = claims.filter(c =>
    c.supportTypes.some(t => t === 'inferred' || t === 'unsupported')
  ).length
  const contradictedCount = claims.filter(c =>
    c.supportTypes.includes('contradicted')
  ).length

  return (
    <div className="claim-ledger">
      <div className="claim-ledger-header">
        <span className="claim-ledger-title">Claim Ledger</span>
        {allCount > 0 && (
          <span className="claim-count-badge">{allCount}</span>
        )}
      </div>

      <div className="filter-bar">
        <button
          className={filterMode === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilterMode('all')}
        >
          All ({allCount})
        </button>
        <button
          className={filterMode === 'weak' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilterMode('weak')}
        >
          Weak ({weakCount})
        </button>
        <button
          className={filterMode === 'contradicted' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilterMode('contradicted')}
        >
          Contradicted ({contradictedCount})
        </button>
      </div>

      {loading && (
        <div className="claim-loading">⏳ Analyzing claims…</div>
      )}

      {!loading && filteredClaims.length === 0 && (
        <div className="claim-empty">
          {allCount === 0 ? 'No claims yet' : 'No claims match this filter'}
        </div>
      )}

      {filteredClaims.map(claim => (
        <ClaimCard
          key={claim.id}
          claim={claim}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  )
}
