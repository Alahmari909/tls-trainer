# Phase 2 — Knowledge Base Rebuild (branch ai-instructor-v2)

## Scope (user constraints)
- ALLOWED: index cleaning, PDF re-extraction, chunk metadata, retrieval logic, image mapping, chunking/context
- FORBIDDEN: UI changes, AI Instructor behavior change, prompt change, design change, Railway deploy, merge to main

## Tasks
1. [ ] Clean index — remove poisoned/OCR-refusal chunks
2. [ ] Re-extract text from all PDFs at best quality
3. [ ] Chunk metadata: filename + section/chapter + real page number
4. [ ] Rebuild search: file -> section -> page (not pure similarity)
5. [ ] Image fix: bind filename+page, no image if no valid match
6. [ ] Fix context truncation + chunk splitting mid-information
7. [ ] Report: files reindexed, pages, new chunks, search success before/after, examples

## Baseline (measured before rebuild)
- total chunks: 1204
- poisoned (OCR refusal): 17
- chunks <200 chars: 131 (10.9%)
- chunks <80 chars: 18
- avg chunk 1251 chars, max 6000
- pdfContext cap 9000 -> 8 chunks x 1251 = 10008 -> TRUNCATION
- ai_doc_page_images rows: 100 (vs 1204 chunks)
- 3 image path schemes: /slides/, /doc-pages/, /api/doc-page/

## Decisions
- isRefusalText() + gpt-4o escalation added to openaiVisionExtract (done, uncommitted)

## SOURCE LOCATION — RESOLVED (2026-08-02)
Earlier "m1-m9 unrecoverable" conclusion was WRONG. Large files live in
`packages/web/static/`, NOT `packages/web/public/`.
- M1-M9 original PDFs: `packages/web/static/pdfs/` (9 files, 62 MB, 627 pages)
  page counts match doc-pages dirs AND DB page counts 1:1 (100%)
- Page images: `packages/web/static/doc-pages/` (40 dirs, 871 jpgs, git-tracked)
- Admin doc copies: `packages/web/static/admin-docs/` (41 pdf + 1 pptx)
- DB source bytes: `document_files.file_data` (base64), 35 rows
- Served by `packages/web/src/server.ts:56` (dist -> static fallback)
- Indexer reads only `static/admin-docs` + `static/pdfs` (index.ts:3438-3445)
- Manual defs: `packages/web/src/web/pages/manuals.tsx:16-26`, open via `/pdfs/<file>`
- 43/43 indexed sources are re-extractable. 0 missing.
Issues found:
- ATC Quick Guide indexed TWICE (m9 + d46) -> duplicate hits
- document_files doc 69 (TLS_Training_Slides.pdf, 32.4MB) has 0 chunks
  (blocked by 30MB cap at index.ts:3459); compressed doc 70 is the indexed one
- doc_id 72 has chunks + bytes but NO row in `documents`
- documents.file_data is 0 bytes for all rows
Report: AI_INSTRUCTOR_PHASE2_SOURCES.md

## Progress log
- 2026-08-02: located all source PDFs, wrote AI_INSTRUCTOR_PHASE2_SOURCES.md.
  No code changes made in this step. Awaiting go-ahead for rebuild.
