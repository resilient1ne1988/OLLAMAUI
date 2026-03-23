CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  retention_policy_default TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  modality TEXT NOT NULL CHECK(modality IN ('text','pdf','image','audio','tool','transcript','screenshot')),
  mime_type TEXT,
  local_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK(extraction_status IN ('pending','complete','failed')),
  retention_policy TEXT NOT NULL DEFAULT 'manual' CHECK(retention_policy IN ('session','24h','7d','project','manual')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS extracted_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  support_types_json TEXT NOT NULL DEFAULT '[]',
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  contradiction_refs_json TEXT NOT NULL DEFAULT '[]',
  confidence_note TEXT,
  regenerate_eligible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evidence_refs (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  label TEXT NOT NULL,
  excerpt TEXT,
  page_number INTEGER,
  timestamp_start_ms INTEGER,
  timestamp_end_ms INTEGER,
  bbox_json TEXT,
  confidence REAL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  description TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  claim_refs_json TEXT NOT NULL DEFAULT '[]',
  related_entity_ids_json TEXT NOT NULL DEFAULT '[]',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_links (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_ref_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence REAL NOT NULL,
  accepted INTEGER
);

CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  field TEXT NOT NULL,
  source_ref_a TEXT NOT NULL,
  source_ref_b TEXT NOT NULL,
  value_a TEXT NOT NULL,
  value_b TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')),
  explanation TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  authoritative_source_ref_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memory_policies (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('source','claim','entity','conflict','message')),
  target_id TEXT NOT NULL,
  retention_policy TEXT NOT NULL CHECK(retention_policy IN ('session','24h','7d','project','manual')),
  expires_at TEXT,
  inherited_from_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(target_type, target_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sources_workspace ON sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sources_expires ON sources(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_source ON extracted_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_claims_message ON claims(message_id);
CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence_refs(claim_id);
CREATE INDEX IF NOT EXISTS idx_entities_workspace ON entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_workspace ON conflicts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memory_target ON memory_policies(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_policies(expires_at) WHERE expires_at IS NOT NULL;
