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

**Not built (deferred from Slice 6):** `PUT` replace-all queries; cross-config compare table.

---

## Future work (not started)

### Slice 7: Search-first UX — ad-hoc testing ranked by MRR

**Problem:** Search and validation testing are buried three levels deep: Datasets → dataset detail → search config → search box. The primary user goal (try a query, see results, compare quality) requires too much navigation before any value.

**Goal:** Make **search the front door**. Users land on a search workspace, pick a config by **latest validation MRR** (or pass rate), run ad-hoc queries immediately, and only drill into datasets/configs when managing data or pipelines.

**Principles:**
- **Search-first IA:** Home and primary sidebar entry = “Search” (not “Datasets”).
- **Config picker by MRR:** List vectorized search configs with **dataset name**, **config name**, **status**, and **latest MRR** (and pass rate) from `validation_runs`; sort default = highest MRR. Configs without a run show “—” and sort last.
- **One screen for testing:** Query input + results table on the same view as config selection (no nested breadcrumbs to reach search).
- **Datasets stay secondary:** Upload, describe, vectorize, validation-set editing remain under Datasets / admin paths; they are setup, not the default path.

**Architecture notes:**
- New API (or extend existing): `GET /api/search-configs` (or `/api/search`) — join `search_datasets` + parent `datasets` + latest `validation_runs` per `(search_dataset_id, validation_set_id?)` to expose `mrr`, `pass_rate`, `recall_at_max_rank`, `run_at`. Filter to `status = 'vectorized'` for the picker.
- Reuse `lib/search/hybrid-search.ts` and existing `GET/POST` search on `search-datasets/[id]/search`; the new page calls the same backend.
- Validation set filter: “validation set” dropdown (default = most recently run set for that dataset) so MRR is comparable across configs.

---

### Task 18: Search configs index API (with latest MRR)

**Files:**
- Create: `app/api/search-configs/route.ts` (name TBD; “search-configs” = `search_datasets` rows exposed for the UI)

**Step 1: `GET` list**

Return array of:
```ts
{
  id: string;                    // search_dataset id
  name: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  embedding_dimension: number | null;
  document_count: number;
  vectorized_count: number;
  latest_validation: {
    validation_set_id: string;
    validation_set_name: string;
    run_at: string;
    mrr: number;
    pass_rate: number;
    recall_at_max_rank: number;
  } | null;
}
```

- Query params: `dataset_id`, `validation_set_id` (when `validation_set_id` is set, only latest run for that set).
- Sort: `latest_validation.mrr` desc nulls last, then `name`.
- Only include configs with `vectorized_count > 0` (or `status = 'vectorized'`) unless `?include_pending=true`.

**Step 2: Commit**

```bash
git add app/api/search-configs
git commit -m "feat: list search configs with latest validation MRR"
```

---

### Task 19: Search workspace page (home)

**Files:**
- Create: `app/search/page.tsx` (or replace `app/page.tsx` as the default landing)
- Modify: `components/layout/app-sidebar.tsx` — primary nav: **Search** → `/search`; Datasets secondary
- Modify: `app/page.tsx` — redirect to `/search` or slim hub linking Search vs Datasets

**Step 1: Layout**

- Left or top: **config picker** (table/cards) — columns: dataset, config name, MRR, pass rate, last run date. Click row = active config.
- Right/main: **search box** + **results** (reuse patterns from `app/search-datasets/[id]/page.tsx` search section).
- Empty state: “No vectorized configs” → link to Datasets / Upload.

**Step 2: Behavior**

- On load: fetch `GET /api/search-configs`; auto-select top MRR config (or last-used from `localStorage`).
- On query submit: `GET /api/search-datasets/[id]/search?q=...` for active config.
- Show active config’s MRR badge in the search header.

**Step 3: Commit**

```bash
git add app/search app/page.tsx components/layout/app-sidebar.tsx
git commit -m "feat: search-first workspace — pick config by MRR, run queries"
```

---

### Task 20: Quick validation run from search workspace

**Files:**
- Modify: `app/search/page.tsx`

**Step 1:** “Run validation” on active config (reuse `POST /api/search-datasets/[id]/validate`) with validation-set dropdown; refresh MRR in picker after run.

**Step 2:** Link “Compare configs” → `/search/compare` (rows = configs, columns = MRR / pass rate for selected validation set).

**Step 3: Commit**

```bash
git add app/search
git commit -m "feat: run validation from search workspace"
```

---

### Task 21: Compare configs by MRR

**Files:**
- Create: `app/search/compare/page.tsx` or section on `/search`

**Step 1:** For a chosen `dataset_id` + `validation_set_id`, show all vectorized configs side-by-side with latest metrics; highlight best MRR.

**Step 2:** Commit

```bash
git add app/search
git commit -m "feat: compare search configs by validation MRR"
```

---

### Execution order (future)

1. Task 18: API — configs + latest MRR (unblocks picker).
2. Task 19: Search workspace — primary landing + sidebar.
3. Task 20: Inline validation from search workspace.
4. Task 21: Cross-config MRR comparison.

**Out of scope for Slice 7:** Auth/multi-tenancy, async job queue for describe/vectorize, launch hosting (see separate launch architecture notes).
