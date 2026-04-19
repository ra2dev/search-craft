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

## Slice 1: Supabase client + Upload (dataset + documents) ✅ Done

### Task 1: Add Supabase server client ✅

**Files:**
- Create: `lib/supabase/server.ts`
- Modify: `package.json` (add dependency)

**Step 1: Add dependency**

Run: `pnpm add @supabase/supabase-js`
Expected: Package added.

**Step 2: Create server client**

Create `lib/supabase/server.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createServerSupabase() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
```

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml lib/supabase/server.ts
git commit -m "chore: add Supabase server client"
```

---

### Task 2: Upload API — POST JSON array → dataset + documents ✅

**Files:**
- Create: `app/api/datasets/upload/route.ts`
- Test: (manual or e2e; add test in a later slice if desired)

**Step 1: Define request shape**

Request body: `{ name: string; rows: Array<{ content: string; metadata?: Record<string, unknown> }> }`. Each row becomes one document.

**Step 2: Implement POST handler**

- Create `app/api/datasets/upload/route.ts`.
- Parse JSON body; validate `name` and `rows` (array, each row has `content` string).
- Call `createServerSupabase()`; insert one row into `datasets` (name); for each row insert into `documents` (dataset_id, content, metadata).
- Return `{ dataset_id, document_count }`.

**Step 3: Commit**

```bash
git add app/api/datasets/upload/route.ts
git commit -m "feat: upload API — create dataset and documents from JSON"
```

---

### Task 3: Upload UI — page to paste/upload JSON ✅

**Files:**
- Create: `app/(dashboard)/datasets/upload/page.tsx` (or under existing layout)
- Modify: `components/layout/app-sidebar.tsx` (add link to Upload if sidebar exists)

**Step 1: Add upload page**

- Page: form with dataset name (input) and JSON textarea (or file input). Submit POST to `/api/datasets/upload`.
- On success: redirect to dataset detail or list; show success message.

**Step 2: Wire sidebar**

- Add "Upload" or "Datasets" link in `app-sidebar.tsx` pointing to the new upload route.

**Step 3: Commit**

```bash
git add app/... components/layout/app-sidebar.tsx
git commit -m "feat: upload UI — create dataset from JSON"
```

---

## Slice 2: Search datasets (CRUD + list) ✅ Done

### Task 4: List datasets API ✅

**Files:** Create `app/api/datasets/route.ts` — GET returns list of `datasets` (id, name, created_at). Use `createServerSupabase()`.

### Task 5: List search configs for a dataset ✅

**Files:** Create `app/api/datasets/[id]/search-datasets/route.ts` — GET returns `search_datasets` for given dataset_id.

### Task 6: Create search dataset API ✅

**Files:** Create `app/api/datasets/[id]/search-datasets/route.ts` — POST body: name, description_prompt, description_model, embedding_model, embedding_dimension (384|768|1536|3072). Insert into `search_datasets`; optionally seed `search_documents` (copy content from documents, no description/embedding yet). Set status = 'uploaded'.

### Task 7: Search datasets UI ✅

**Files:** Pages/routes: list datasets; dataset detail with list of search configs; form to create search config (name, prompt, models, dimension). Wire to APIs above.

---

## Slice 3: Describe (LLM) ✅ Done

### Task 8: Describe API / job ✅

**Files:** Create `app/api/search-datasets/[id]/describe/route.ts` (or background job). For each `search_document` with null description, call LLM with `description_prompt` + document content; write description to `search_documents.description`. Update `search_datasets.status` to 'described' when done.

### Task 9: Describe UI ✅

**Files:** Button or action on search-dataset detail to "Run describe"; call describe API; show progress or success.

---

## Slice 4: Vectorize (embeddings) ✅ Done

### Task 10: Vectorize API / job ✅

**Files:** Create `app/api/search-datasets/[id]/vectorize/route.ts`. For each `search_document`, embed (content + description) with configured embedding_model; write to the correct `embedding_*` column per `search_datasets.embedding_dimension`. Update status to 'vectorized'.

### Task 11: Vectorize UI ✅

**Files:** Button "Run vectorize" on search-dataset detail; call vectorize API; show success.

---

## Slice 5: Search (hybrid) ✅ Done

### Task 12: Search API ✅

**Files:** Create `app/api/search-datasets/[id]/search/route.ts`. Query params: `q`, optional `k`. Hybrid: vector search (using the correct embedding_* column) + FTS on `search_vector`; combine/rank; return top-k doc IDs and snippets.

### Task 13: Search UI ✅

**Files:** Search box on search-dataset detail; call search API; display ranked results.

---

## Slice 6: Validation (dataset-level sets, reusable across search configs) ✅ Done

**Design goals:**
- Each **`dataset` can have many validation sets** (e.g. "smoke tests", "edge cases", "hard negatives"), each a named collection of queries + expected docs.
- Any validation set can be **run against any `search_dataset`** (config) derived from that same dataset — enabling side-by-side comparison of configs on the same queries.
- Each **validation query carries a per-query rank constraint (`max_rank`)**: e.g. query `"cake"` with `max_rank = 10` means the expected document(s) must appear in the top 10; query `"heart"` with `max_rank = 1` means expected must be rank 1 (first result).
- A **validation run** records which `validation_set` + which `search_dataset` was evaluated and the resulting metrics (pass rate, recall@max_rank, MRR).

### Task 14: Schema changes for dataset-level validation sets ✅

**Files:**
- Modify: `supabase/schemas/06_validation_sets.sql`
- Modify: `supabase/schemas/07_validation_queries.sql`
- Modify: `supabase/schemas/08_validation_runs.sql`
- Modify: `supabase/schemas/09_indexes.sql`
- Create: `supabase/migrations/<timestamp>_validation_dataset_level.sql`

**Step 1: `validation_sets` → scoped to `dataset_id` (many per dataset)**

```sql
-- schemas/06_validation_sets.sql
create table public.validation_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dataset_id, name)
);
```

(Drop `search_dataset_id`; scope sets by `dataset_id`. Many sets per dataset, names unique within a dataset.)

**Step 2: `validation_queries` → add `max_rank`**

```sql
-- schemas/07_validation_queries.sql
create table public.validation_queries (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  query text not null,
  expected_document_ids uuid[] not null default '{}',
  max_rank int not null default 10 check (max_rank >= 1),
  created_at timestamptz not null default now()
);

comment on column public.validation_queries.max_rank is
  'Expected document(s) must appear within this rank in the search results (e.g. 1 = first, 10 = top 10).';
```

**Step 3: `validation_runs` → record which `search_dataset` was evaluated**

```sql
-- schemas/08_validation_runs.sql
create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  search_dataset_id uuid not null references public.search_datasets(id) on delete cascade,
  run_at timestamptz not null default now(),
  params jsonb default '{}',
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on column public.validation_runs.metrics is
  'e.g. { "pass_rate": 0.82, "recall_at_max_rank": 0.9, "mrr": 0.78, "per_query": [...] }';
```

**Step 4: Indexes**

Update `schemas/09_indexes.sql`:
- Drop `validation_sets_search_dataset_id_idx` (column gone).
- Add `validation_sets_dataset_id_idx on public.validation_sets(dataset_id)`.
- Add `validation_runs_search_dataset_id_idx on public.validation_runs(search_dataset_id)`.

**Step 5: Migration**

Create `supabase/migrations/<timestamp>_validation_dataset_level.sql`:

```sql
-- validation_sets: move from search_dataset_id → dataset_id (many per dataset)
alter table public.validation_sets
  add column dataset_id uuid references public.datasets(id) on delete cascade;

-- best-effort backfill: copy dataset_id via search_datasets
update public.validation_sets vs
set dataset_id = sd.dataset_id
from public.search_datasets sd
where vs.search_dataset_id = sd.id;

alter table public.validation_sets
  alter column dataset_id set not null,
  add constraint validation_sets_dataset_id_name_key unique (dataset_id, name);

drop index if exists public.validation_sets_search_dataset_id_idx;
alter table public.validation_sets drop column search_dataset_id;
create index if not exists validation_sets_dataset_id_idx
  on public.validation_sets(dataset_id);

-- validation_queries: per-query rank threshold
alter table public.validation_queries
  add column max_rank int not null default 10 check (max_rank >= 1);

comment on column public.validation_queries.max_rank is
  'Expected document(s) must appear within this rank in the search results (e.g. 1 = first, 10 = top 10).';

-- validation_runs: record which search config was evaluated
alter table public.validation_runs
  add column search_dataset_id uuid references public.search_datasets(id) on delete cascade;

alter table public.validation_runs
  alter column search_dataset_id set not null;

create index if not exists validation_runs_search_dataset_id_idx
  on public.validation_runs(search_dataset_id);
```

**Step 6: Commit**

```bash
git add supabase/schemas supabase/migrations
git commit -m "feat(db): dataset-level validation sets + per-query max_rank"
```

---

### Task 15: Validation sets + queries API (dataset-scoped, many per dataset) ✅

**Files:**
- Create: `app/api/datasets/[id]/validation-sets/route.ts`
- Create: `app/api/validation-sets/[id]/route.ts`
- Create: `app/api/validation-sets/[id]/queries/route.ts`

**Step 1: `GET /api/datasets/[id]/validation-sets`**

- Return list of `validation_sets` for the dataset (id, name, created_at, query count).

**Step 2: `POST /api/datasets/[id]/validation-sets`**

- Body: `{ name: string }`. Insert a new validation set scoped to `dataset_id`. Reject on unique `(dataset_id, name)` conflict with a 409. Return the created set.

**Step 3: `GET /api/validation-sets/[id]` (and `DELETE`)**

- `GET` returns the set plus its `validation_queries`.
- `DELETE` removes the set (cascades queries + runs).

**Step 4: `POST /api/validation-sets/[id]/queries`**

- Body: `Array<{ query: string; expected_document_ids: string[]; max_rank?: number }>` (default `max_rank = 10`).
- Bulk insert into `validation_queries`. Return count + inserted rows.
- Optionally `PUT` to replace the whole set of queries.

**Step 5: Commit**

```bash
git add app/api/datasets/[id]/validation-sets app/api/validation-sets
git commit -m "feat: dataset-level validation sets + queries API"
```

---

### Task 16: Run validation API (pick a set, run against a search config) ✅

**Files:**
- Create: `app/api/search-datasets/[id]/validate/route.ts`

**Step 1: `POST /api/search-datasets/[id]/validate`**

- Body: `{ validation_set_id: string }`.
- Resolve the `search_dataset`; look up its parent `dataset_id`; load the `validation_set` and **verify its `dataset_id` matches** the `search_dataset`'s parent (reject with 400 otherwise). Load its `validation_queries`.
- For each `validation_query`:
  - Run the search function directly (not over HTTP) on this `search_dataset` with `q = query`, `k = max(max_rank, 10)` so aggregate recall@10 / MRR@10 stay comparable across sets.
  - For each `expected_document_id`, find its rank in the result list (1-indexed; `Infinity` if missing).
  - `passed = every expected doc has rank <= max_rank`.
  - Record `best_rank = min(ranks)` (for MRR).
- Aggregate:
  - `pass_rate = passed / total`
  - `recall_at_max_rank = mean(per-query: fraction of expected docs with rank <= max_rank)`
  - `mrr = mean(1 / best_rank)` (0 if missing)
- Insert a `validation_runs` row with `{ validation_set_id, search_dataset_id, params, metrics }` where `metrics` includes `per_query: [...]`.
- Return `{ run_id, metrics, per_query: [{ query, max_rank, expected_document_ids, ranks, best_rank, passed }] }`.

**Step 2: Optional — list runs**

- `GET /api/search-datasets/[id]/validation-runs` — list prior runs for this search config (joined with `validation_sets.name`), for comparison views.

**Step 3: Commit**

```bash
git add app/api/search-datasets/[id]/validate
git commit -m "feat: run a chosen validation set against a search_dataset"
```

---

### Task 17: Validation UI ✅

**Files:**
- Modify: `app/datasets/[id]/page.tsx` — list the dataset's validation sets, create a new named set, open a set for editing.
- Create: `app/validation-sets/[id]/page.tsx` — set detail: list/edit queries, JSON-paste uploader, delete.
- Modify: `app/search-datasets/[id]/page.tsx` — select which validation set to run (dropdown of the parent dataset's sets), "Run validation" button, display pass rate, recall@max_rank, MRR, and a per-query table (query, max_rank, best rank, pass/fail). Optional: history of prior runs for this config.
- Optional: component to compare runs across search configs for the same validation set (rows = configs, columns = metrics).

**Step 1: Queries JSON format for the UI upload**

```json
[
  { "query": "cake",  "expected_document_ids": ["<uuid>"], "max_rank": 10 },
  { "query": "heart", "expected_document_ids": ["<uuid>"], "max_rank": 1 }
]
```

**Step 2: Commit**

```bash
git add app/datasets/[id]/page.tsx app/search-datasets/[id]/page.tsx
git commit -m "feat: validation UI — manage set on dataset, run per search config"
```

---

## Execution order

1. ✅ Slice 1 (Tasks 1–3): Supabase client + Upload. Required before anything else.
2. ✅ Slice 2 (Tasks 4–7): Search datasets CRUD.
3. ✅ Slice 3 (Tasks 8–9): Describe.
4. ✅ Slice 4 (Tasks 10–11): Vectorize.
5. ✅ Slice 5 (Tasks 12–13): Search.
6. ✅ Slice 6 (Tasks 14–17): Validation (many dataset-level sets; reusable across search configs; per-query `max_rank`).

Test after each slice (manual or automated). DRY: reuse `createServerSupabase()` and shared types (e.g. dataset_status, embedding dimensions) where possible.
