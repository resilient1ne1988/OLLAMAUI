
## Best follow-up prompt to paste into Copilot Chat

Use this right after saving the spec file:

```text
Read docs/OLLAMAUI_NEXT_FEATURE_SPEC.md and implement Phase 1 only. Start by creating the core TypeScript interfaces, SQLite schema, backend service scaffolding, and React state structure required for Source Registry, Evidence Graph, and Memory Policies. Do not implement cloud features. Keep everything local-first. Use modular folders, strict typing, and JSON-safe contracts. After scaffolding, summarize created files and remaining TODOs.
Then use these phase prompts one at a time
Phase 2 prompt
Using docs/OLLAMAUI_NEXT_FEATURE_SPEC.md, implement Claim Ledger MVP only. Add claim segmentation, support classification, evidence linking, persistence, and a right-side Claim Ledger panel in the UI. Make unsupported and contradicted claims visually distinct. Summarize every file you create or modify.
Phase 3 prompt
Using docs/OLLAMAUI_NEXT_FEATURE_SPEC.md, implement Capture Director MVP only. Add source sufficiency heuristics, top missing-input suggestion generation, persistence, dismissal support, and a UI card above the answer area. Keep logic local-first and explain all created files.
Phase 4 prompt
Using docs/OLLAMAUI_NEXT_FEATURE_SPEC.md, implement Conflict-First Mode MVP only. Add structured fact extraction, conflict detection, persistence, and a conflict banner plus resolution panel. Link conflicts to Claim Ledger claims where applicable.
Phase 5 prompt
Using docs/OLLAMAUI_NEXT_FEATURE_SPEC.md, implement Entity Threading MVP only. Add manual entity creation from selected text or image regions, entity persistence, entity drawer UI, and entity-scoped querying. Keep the implementation modular and local-first.
Phase 6 prompt
Using docs/OLLAMAUI_NEXT_FEATURE_SPEC.md, implement Memory Expiration Physics. Add retention policies, expiration badges, cleanup jobs, cascade behavior for derived artifacts, and settings for workspace default retention.