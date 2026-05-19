# Search Optimizer Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Search Optimizer platform (upload → search configs → describe → vectorize → search, plus validation) on top of the existing Supabase domain entities.

**Architecture:** Next.js App Router; all Supabase access from server (API routes) with service role. No Supabase client in the browser. Entities and schemas are already in place (`supabase/schemas/`); this plan adds API routes and UI for each flow.

**Tech Stack:** Next.js 16, Supabase (Postgres + pgvector), @supabase/supabase-js (server only), OpenAI (or configurable) for describe/embed.

---

## Prerequisites

- Domain entities are implemented (see `docs/plans/2025-02-19-entities-design.md`).
- Supabase project with migrations applied (schemas in `supabase/schemas/`).
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and later `OPENAI_API_KEY` or equivalent).

---

## Implemented ✅ (Slices 1–7)

**Conventions:** Server-only Supabase (`lib/supabase/server.ts`). Large datasets batched via `POSTGREST_MAX_ROWS` (1000) in upload, describe, vectorize, and search-document seeding.

### Slice 1 — Upload
- **`lib/supabase/server.ts`** — service-role client
- **`POST /api/datasets/upload`** — `{ name, rows: [{ content, metadata? }] }` → `datasets` + `documents`; batched inserts
- **`/datasets/upload`** — JSON paste/file upload UI; sidebar link

### Slice 2 — Search configs (CRUD)
- **`GET /api/datasets`** — list datasets
- **`GET|POST /api/datasets/[id]/search-datasets`** — list/create `search_datasets`; POST seeds `search_documents` from documents (paginated)
- **UI:** `/datasets`, `/datasets/[id]` — list datasets, create configs (name, prompt, models, dimension 384|768|1536|3072)

### Slice 3 — Describe
- **`POST /api/search-datasets/[id]/describe`** — LLM description per pending `search_document`; paginated; status → `described`
- **UI:** “Run describe” on `/search-datasets/[id]`

### Slice 4 — Vectorize
- **`POST /api/search-datasets/[id]/vectorize`** — embed content + description → `embedding_*` column; paginated; status → `vectorized`
- **UI:** “Run vectorize” on `/search-datasets/[id]`

### Slice 5 — Hybrid search
- **`lib/search/hybrid-search.ts`** — shared vector + FTS ranker
- **`GET /api/search-datasets/[id]/search?q=&k=`** — hybrid search, snippets + scores
- **UI:** search box + results on `/search-datasets/[id]`

### Slice 6 — Validation
- **DB:** `validation_sets` scoped to `dataset_id` (many per dataset); `validation_queries.max_rank`; `validation_runs.search_dataset_id` + metrics JSON (`pass_rate`, `recall_at_max_rank`, `mrr`, `per_query`)
- **APIs:**
  - `GET|POST /api/datasets/[id]/validation-sets`
  - `GET|DELETE /api/validation-sets/[id]`
  - `POST /api/validation-sets/[id]/queries` — bulk queries; `expected_contents` or `expected_document_ids`
  - `POST /api/search-datasets/[id]/validate` — run set against config (in-process search, not HTTP)
  - `GET /api/search-datasets/[id]/validation-runs` — run history
- **UI:** validation sets on `/datasets/[id]`; query editor `/validation-sets/[id]`; run + metrics + history on `/search-datasets/[id]`
- **Query upload JSON:** `{ query, expected_document_ids | expected_contents, max_rank? }` (default `max_rank: 10`)

**Pipeline:** Upload → create search config → describe → vectorize → search / validate.

### Slice 7 — Search-first UX (ad-hoc testing ranked by MRR)
- **`GET /api/search-configs`** — vectorized configs with dataset name, document counts, latest validation metrics (`mrr`, `pass_rate`, `recall_at_max_rank`, `run_at`); query params `dataset_id`, `validation_set_id`, `include_pending`; sorted by MRR desc (nulls last)
- **`/search`** — primary workspace: config picker by MRR, hybrid search, inline validation run, MRR badge on active config; `localStorage` for last config / validation set
- **`/search/compare`** — side-by-side config metrics for a dataset + validation set; best MRR highlighted
- **Nav:** sidebar **Search** first; `/` redirects to `/search`; Datasets remain secondary (upload, describe, vectorize, validation-set editing)

**Pipeline:** Upload → create search config → describe → vectorize → **search workspace** (default) / validate / compare.

**Not built (deferred):** `PUT` replace-all validation queries; default MRR filter = most recently run validation set per dataset; last-run column in config picker.

---

## Future work (not started)

**Out of scope (platform):** Auth/multi-tenancy, async job queue for describe/vectorize, launch hosting.
