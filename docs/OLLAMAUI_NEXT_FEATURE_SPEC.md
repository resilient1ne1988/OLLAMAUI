phase.

# OllamaUI Next-Gen Multimodal Differentiators
## Copilot-Ready Product + Engineering Spec

## 1. Product Goal

Transform OllamaUI from a generic local chat client into a **multimodal AI control center** that is:
- more trustworthy
- better at handling messy real-world inputs
- more useful for serious work on Windows
- more transparent about what the model knows, inferred, or cannot verify

This spec defines five major differentiating features:

1. Claim Ledger
2. Capture Director
3. Entity Threading
4. Conflict-First Mode
5. Memory Expiration Physics

The app must remain:
- local-first
- privacy-respecting
- Windows-friendly
- compatible with Ollama-hosted models
- understandable to non-technical users
- inspectable by power users

---

## 2. Core Design Principles

### 2.1 Local-first
All analysis should run locally whenever possible. Do not require cloud services for the core feature set.

### 2.2 Trust over flair
The UI must help users understand:
- what came from source material
- what came from OCR or transcription
- what was inferred
- what is contradictory
- what may be unsupported

### 2.3 Multimodal by default
The system must treat text, image, PDF, screenshot, audio, transcript, and tool output as first-class sources.

### 2.4 Incremental enhancement
Each feature must work independently and degrade gracefully if some modalities are unavailable.

### 2.5 Copilot-friendly code structure
Use explicit TypeScript interfaces, modular services, and deterministic JSON contracts so implementation is easy to scaffold and extend.

---

## 3. High-Level User Value

Users should be able to:
- drop in mixed files and ask questions confidently
- see exactly which parts of answers are grounded
- be told what missing input would most improve the answer
- track important entities across files, chats, screenshots, and audio
- detect contradictions before the app confidently says something wrong
- choose how long their data persists locally

---

## 4. Feature 1: Claim Ledger

## 4.1 Purpose
Break every model answer into **atomic claims** and classify each claim by evidence strength and source modality.

Instead of giving one giant response blob, the UI must expose the answer as inspectable units.

## 4.2 User Story
As a user, when I receive an answer, I want to see:
- which statements are directly supported
- which statements were inferred
- which statements are contradicted
- which statements are unsupported

## 4.3 UX Requirements
After the model answers:
- split answer into claims
- render claims in a right-side “Claim Ledger” panel
- each claim shows badges such as:
  - Text-supported
  - Image-supported
  - Audio-supported
  - Tool-derived
  - Inferred
  - Contradicted
  - Unsupported
- clicking a claim opens an evidence drawer showing:
  - source file name
  - source type
  - exact supporting excerpt or region
  - confidence notes
  - contradiction notes if applicable
- allow “Regenerate this claim only”
- allow “Show only weak claims”
- allow “Show only contradicted claims”

## 4.4 Functional Logic
1. Generate answer
2. Run a post-processing step that:
   - splits answer into claim-sized units
   - classifies each claim
   - links each claim to one or more evidence references
3. Persist claims to local storage
4. Render claims with badges and evidence panel

## 4.5 Minimal Technical Approach
- sentence split heuristics first
- optional model-based refinement for claim segmentation
- evidence linking based on retrieved chunks, OCR regions, transcript spans, and tool outputs
- contradiction detection reused from Conflict-First Mode

## 4.6 Data Model
```ts
export type ClaimSupportType =
  | "text_supported"
  | "image_supported"
  | "audio_supported"
  | "tool_derived"
  | "inferred"
  | "contradicted"
  | "unsupported";

export interface EvidenceRef {
  id: string;
  sourceId: string;
  modality: "text" | "image" | "audio" | "pdf" | "tool";
  label: string;
  excerpt?: string;
  pageNumber?: number;
  timestampStartMs?: number;
  timestampEndMs?: number;
  bbox?: { x: number; y: number; w: number; h: number };
  confidence?: number;
}

export interface Claim {
  id: string;
  messageId: string;
  text: string;
  supportTypes: ClaimSupportType[];
  evidenceRefs: string[];
  contradictionRefs: string[];
  confidenceNote?: string;
  regenerateEligible: boolean;
}
4.7 Acceptance Criteria
claims are visible for every assistant answer
each claim has at least one support classification
clicking a claim reveals linked evidence
contradicted claims are visually distinct
unsupported claims are clearly marked and never disguised as grounded
5. Feature 2: Capture Director
5.1 Purpose

Before or after answering, the app should identify the single most valuable missing input that would improve answer quality.

This feature helps users collect better evidence instead of getting low-quality guesses.

5.2 User Story

As a user, if my input is incomplete, I want the app to tell me exactly what additional capture would help most.

5.3 UX Requirements

If inputs are weak, ambiguous, blurry, partial, or missing a useful modality:

show a “Capture Director” card above the answer area
the card should say things like:
Upload the PDF instead of a screenshot
Crop closer to the serial number
Add a second image from the side
Record 10 seconds of the sound
Provide the CSV instead of pasted table text
estimate expected improvement:
low
medium
high
user can:
ignore suggestion
follow suggestion
disable suggestions for current session
5.4 Functional Logic
inspect current sources
score source sufficiency by modality
detect missing or weak inputs
generate 1 to 3 specific capture suggestions
prioritize the highest-impact suggestion
5.5 Data Model
export interface CaptureSuggestion {
  id: string;
  workspaceId: string;
  reason: string;
  suggestionText: string;
  recommendedModality: "text" | "image" | "audio" | "pdf" | "csv" | "screenshot";
  expectedImpact: "low" | "medium" | "high";
  relatedSourceIds: string[];
  dismissed: boolean;
}
5.6 Example Heuristics
blurry image + object identification request -> suggest higher-res close-up
screenshot of tabular data + calculation request -> suggest CSV
audio only + speaker-specific summary request -> suggest participant names or transcript
PDF scan with low OCR confidence -> suggest original digital PDF
5.7 Acceptance Criteria
weak inputs trigger at least one useful suggestion
suggestion language is concrete, not vague
user can dismiss suggestions
dismissed suggestions do not reappear repeatedly in same context
6. Feature 3: Entity Threading
6.1 Purpose

Let users pin and track real entities across chats and modalities.

An entity is anything the user cares about:

a person
a product
a car part
a chart series
a file number
a visual object
a contract clause
a speaker in audio
a UI button in a screenshot
6.2 User Story

As a user, I want to mark “this exact thing” once and have the app follow it across sources and future chats.

6.3 UX Requirements

Users can:

highlight text and create entity
click a region in image and create entity
mark a speaker segment in transcript and create entity
pin claims to an entity
open an entity drawer showing:
summary
related files
related claims
related transcript moments
linked screenshots or image regions
unresolved contradictions
ask follow-up questions scoped to that entity only
6.4 Functional Logic
create entity nodes
allow manual linking
optionally suggest auto-links based on name similarity, OCR match, transcript mentions, and user confirmations
store an entity graph locally
6.5 Data Model
export interface Entity {
  id: string;
  workspaceId: string;
  name: string;
  entityType: string;
  description?: string;
  aliases: string[];
  sourceRefs: string[];
  claimRefs: string[];
  relatedEntityIds: string[];
  pinned: boolean;
}

export interface EntityLinkSuggestion {
  id: string;
  entityId: string;
  sourceRefId: string;
  reason: string;
  confidence: number;
  accepted?: boolean;
}
6.6 Acceptance Criteria
user can create an entity from text or visual region
entity drawer shows cross-modal references
follow-up queries can be entity-scoped
entity relationships persist across app restarts if memory policy allows
7. Feature 4: Conflict-First Mode
7.1 Purpose

Detect contradictory information across files, screenshots, OCR, transcripts, and tool output before final answer presentation.

The app should not confidently flatten conflicting inputs into one story.

7.2 User Story

As a user, if my sources disagree, I want the app to surface the conflict instead of pretending certainty.

7.3 UX Requirements

If contradictions are detected:

show a “Conflicts Detected” banner before the final answer
show a structured conflict list:
claim A
source A
claim B
source B
why they conflict
offer actions:
answer cautiously anyway
ask a resolution question
exclude one source
mark one source as authoritative
request more input via Capture Director
7.4 Functional Logic
normalize extracted facts into comparable units
compare across sources
create conflict objects
if conflicts exceed threshold:
enter conflict-first UX path
downgrade certainty in answer composition
tag related claims in Claim Ledger
7.5 Data Model
export interface Conflict {
  id: string;
  workspaceId: string;
  subject: string;
  field: string;
  sourceRefA: string;
  sourceRefB: string;
  valueA: string;
  valueB: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  resolved: boolean;
  authoritativeSourceRefId?: string;
}
7.6 Example Conflict Types
two different dates
two different totals
two different names
text extracted from image conflicts with PDF text
transcript statement conflicts with slide deck figure
tool output conflicts with user-provided data
7.7 Acceptance Criteria
conflicting structured facts generate a conflict object
answer UI visibly warns user before presenting shaky synthesis
conflicted claims are linked into Claim Ledger
user can resolve conflicts manually
8. Feature 5: Memory Expiration Physics
8.1 Purpose

Let users control how long multimodal data persists locally.

This feature makes privacy and workspace hygiene visible and understandable.

8.2 User Story

As a user, I want to decide whether a file, screenshot, transcript, claim, or entity lasts:

one session
one day
one project
forever until deleted
8.3 UX Requirements

Every source and derived artifact must have a memory policy:

session-only
24 hours
7 days
project-retained
manual-retain
manual-delete

The UI must show:

what will expire
when it expires
what has already expired
which derived items will be deleted with it

Examples:

uploaded screenshot expires in 24h
claims derived from that screenshot expire with it
pinned entity survives only if explicitly promoted
8.4 Functional Logic
every source, claim, entity, and conflict stores retention policy
background cleanup job purges expired records
deletion cascades through derived data unless user overrides
UI exposes retention badge everywhere relevant
8.5 Data Model
export type RetentionPolicy =
  | "session"
  | "24h"
  | "7d"
  | "project"
  | "manual";

export interface MemoryPolicy {
  id: string;
  targetType: "source" | "claim" | "entity" | "conflict" | "message";
  targetId: string;
  retentionPolicy: RetentionPolicy;
  expiresAt?: string;
  inheritedFromId?: string;
}
8.6 Acceptance Criteria
all new inputs have a default retention policy
user can override policy per source or workspace
expired items are removed cleanly
related derived artifacts honor cascade rules
9. Shared Foundation Required for All Features

These five features require a shared backend and frontend foundation.

9.1 Source Registry

Create a normalized source registry for all inputs:

text snippets
files
PDFs
screenshots
images
audio
transcripts
tool results
shell results
export interface SourceRecord {
  id: string;
  workspaceId: string;
  name: string;
  modality: "text" | "pdf" | "image" | "audio" | "tool" | "transcript" | "screenshot";
  mimeType?: string;
  localPath?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  extractionStatus: "pending" | "complete" | "failed";
  retentionPolicy: RetentionPolicy;
}
9.2 Evidence Graph

All features must link through a graph of:

sources
extracted chunks
claims
entities
conflicts
messages
9.3 Extraction Pipeline

Implement extraction services for:

plain text files
PDFs
OCR-capable images
screenshots
audio transcription
shell/tool output normalization
9.4 Workspace Context Engine

The backend must gather:

active workspace sources
entity-scoped sources
non-expired sources only
optionally conflict-filtered sources
9.5 Local Persistence

Prefer local SQLite for:

reliability
graph-like linking
filtering
retention cleanup
efficient workspace restore
10. Recommended App Architecture
10.1 Frontend

React + TypeScript

Suggested folders:

src/
  components/
    claim-ledger/
    capture-director/
    entity-threading/
    conflict-center/
    memory-policy/
    shared/
  features/
    chat/
    sources/
    workspaces/
  hooks/
  store/
  types/
  utils/
10.2 Backend

Node + Express + TypeScript

Suggested folders:

server/
  routes/
  services/
    extraction/
    evidence/
    claims/
    capture/
    entities/
    conflicts/
    memory/
    ollama/
  db/
  types/
  utils/
10.3 Electron

Use Electron only for:

desktop shell
filesystem integration
tray
OS-level file picking
optional screenshot/audio capture hooks later

Keep feature logic mostly in shared backend/frontend code, not Electron-specific code.

11. Suggested Implementation Order
Phase 1: Foundation

Build:

Source Registry
local SQLite schema
extraction pipeline
evidence reference contracts
workspace context engine
Phase 2: Claim Ledger MVP

Build:

claim segmentation
support classification
evidence drawer
weak/unsupported claim badges
Phase 3: Capture Director MVP

Build:

source sufficiency scoring
top suggestion generator
UI suggestion card
Phase 4: Conflict-First Mode MVP

Build:

structured fact extraction
conflict detection
conflict banner and resolution panel
Phase 5: Entity Threading MVP

Build:

manual entity creation
entity drawer
link claims and sources to entity
entity-scoped querying
Phase 6: Memory Expiration Physics

Build:

retention policies
cleanup job
retention badges
cascade deletion rules
Phase 7: Polish

Add:

partial claim regeneration
auto-link entity suggestions
authority source preferences
improved confidence explanations
12. Database Schema Guidance

Use SQLite tables roughly like:

workspaces
messages
sources
extracted_chunks
claims
evidence_refs
entities
entity_links
conflicts
memory_policies

Relationships:

source -> extracted_chunks
message -> claims
claim -> evidence_refs
entity -> source refs + claim refs
conflicts -> two or more evidence/source refs
all major records -> memory_policies
13. UX Details
13.1 Main Chat Layout

Three-panel desktop layout:

left: workspace/files/entities
center: chat thread + composer
right: contextual inspection panel

The right panel changes between:

Claim Ledger
Evidence Viewer
Conflict Center
Entity Drawer
Memory Policy Inspector
13.2 Visual Language

Use color/status conventions consistently:

grounded/support = calm positive
inferred = neutral
contradicted = warning
unsupported = danger
expiring soon = time-sensitive

Do not make unsupported content look authoritative.

13.3 User Control

Every assistive feature must be dismissible or toggleable:

Capture Director on/off
Conflict-First prompt threshold
retention defaults per workspace
entity suggestions on/off
14. Non-Goals for Initial Version

Do not build yet:

cloud sync
team collaboration
remote vector database dependency
full autonomous agents
complex OCR training
speaker diarization perfection
auto-acting workflows without user confirmation

Keep v1 focused and robust.

15. Quality Bar

This project succeeds only if:

the app feels faster and more trustworthy than a generic chat wrapper
users can inspect why the model said something
users can recover from bad or incomplete inputs
users can manage private local memory clearly
multimodal work feels organized rather than chaotic
16. Engineering Constraints
use TypeScript everywhere possible
use explicit interfaces for all structured outputs
avoid hidden implicit state
all model-facing structured tasks should request JSON output with strict validation
every feature should have mockable services for local testing
errors must degrade gracefully into clear UI states
17. JSON Contracts Required for Model-Assisted Tasks

The backend should define strict schemas for:

claim segmentation response
claim support classification response
capture suggestions
extracted fact comparison
entity link suggestions

Validate model outputs before persisting.

18. Example Copilot Task Breakdown
Task 1

Create the TypeScript interfaces for:

SourceRecord
EvidenceRef
Claim
CaptureSuggestion
Entity
Conflict
MemoryPolicy
Task 2

Set up SQLite persistence layer and migrations for all core tables.

Task 3

Build a source ingestion service supporting:

txt
md
pdf
png/jpg screenshots
tool output text
Task 4

Build Claim Ledger MVP:

sentence segmentation
claim storage
basic support badges
evidence panel UI
Task 5

Build Capture Director MVP:

simple heuristics
one suggestion card
dismiss support
Task 6

Build Conflict-First MVP:

structured fact extraction
detect obvious field conflicts
banner + conflict list UI
Task 7

Build Entity Threading MVP:

manual entity creation from text selection
entity drawer
entity-scoped query filter
Task 8

Build Memory Expiration Physics:

retention defaults
expiration badge
cleanup service
19. Definition of Done

This spec is considered implemented when:

mixed source types can be ingested locally
answers produce visible inspectable claims
weak inputs trigger concrete capture guidance
cross-source contradictions are surfaced before or with final answer
users can pin entities across sources
retention policy is visible and enforceable
all major objects persist locally and restore cleanly
20. Final Product Positioning

OllamaUI should feel like:

“A Windows-native local multimodal AI workspace that does not just answer, but shows its evidence, detects conflicts, guides better input capture, tracks important entities, and gives users control over memory.”

