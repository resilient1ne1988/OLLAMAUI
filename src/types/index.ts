// ─── Retention ───────────────────────────────────────────────────────────────
export type RetentionPolicy = 'session' | '24h' | '7d' | 'project' | 'manual'

export interface MemoryPolicy {
  id: string
  targetType: 'source' | 'claim' | 'entity' | 'conflict' | 'message'
  targetId: string
  retentionPolicy: RetentionPolicy
  expiresAt?: string
  inheritedFromId?: string
}

// ─── Workspace ───────────────────────────────────────────────────────────────
export interface Workspace {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  retentionPolicyDefault: RetentionPolicy
}

export interface WorkspaceContext {
  workspaceId: string
  activeSources: number
  activeEntities: number
  unresolvedConflicts: number
  sourcesByModality: Record<string, number>
}

// ─── Sources ─────────────────────────────────────────────────────────────────
export type SourceModality = 'text' | 'pdf' | 'image' | 'audio' | 'tool' | 'transcript' | 'screenshot'
export type ExtractionStatus = 'pending' | 'complete' | 'failed'

export interface SourceRecord {
  id: string
  workspaceId: string
  name: string
  modality: SourceModality
  mimeType?: string
  localPath?: string
  createdAt: string
  metadata: Record<string, unknown>
  extractionStatus: ExtractionStatus
  retentionPolicy: RetentionPolicy
  expiresAt?: string
}

// ─── Claims + Evidence ───────────────────────────────────────────────────────
export type ClaimSupportType =
  | 'text_supported'
  | 'image_supported'
  | 'audio_supported'
  | 'tool_derived'
  | 'inferred'
  | 'contradicted'
  | 'unsupported'

export interface EvidenceRef {
  id: string
  claimId: string
  sourceId: string
  modality: SourceModality
  label: string
  excerpt?: string
  pageNumber?: number
  timestampStartMs?: number
  timestampEndMs?: number
  bbox?: { x: number; y: number; w: number; h: number }
  confidence?: number
}

export interface Claim {
  id: string
  messageId: string
  text: string
  supportTypes: ClaimSupportType[]
  evidenceRefs: string[]
  contradictionRefs: string[]
  confidenceNote?: string
  regenerateEligible: boolean
}

// ─── Entities ────────────────────────────────────────────────────────────────
export interface Entity {
  id: string
  workspaceId: string
  name: string
  entityType: string
  description?: string
  aliases: string[]
  sourceRefs: string[]
  claimRefs: string[]
  relatedEntityIds: string[]
  pinned: boolean
}

// ─── Conflicts ───────────────────────────────────────────────────────────────
export interface Conflict {
  id: string
  workspaceId: string
  subject: string
  field: string
  sourceRefA: string
  sourceRefB: string
  valueA: string
  valueB: string
  severity: 'low' | 'medium' | 'high'
  explanation: string
  resolved: boolean
  authoritativeSourceRefId?: string
}

// ─── Capture Director ────────────────────────────────────────────────────────
export interface CaptureSuggestion {
  id: string
  workspaceId: string
  reason: string
  suggestionText: string
  recommendedModality: 'text' | 'image' | 'audio' | 'pdf' | 'csv' | 'screenshot'
  expectedImpact: 'low' | 'medium' | 'high'
  relatedSourceIds: string[]
  dismissed: boolean
}
