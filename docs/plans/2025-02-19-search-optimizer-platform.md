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

## Slice 1: Supabase client + Upload (dataset + documents)

### Task 1: Add Supabase server client

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

### Task 2: Upload API — POST JSON array → dataset + documents

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

### Task 3: Upload UI — page to paste/upload JSON

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

## Slice 2: Search datasets (CRUD + list)

### Task 4: List datasets API

**Files:** Create `app/api/datasets/route.ts` — GET returns list of `datasets` (id, name, created_at). Use `createServerSupabase()`.

### Task 5: List search configs for a dataset

**Files:** Create `app/api/datasets/[id]/search-datasets/route.ts` — GET returns `search_datasets` for given dataset_id.

### Task 6: Create search dataset API

**Files:** Create `app/api/datasets/[id]/search-datasets/route.ts` — POST body: name, description_prompt, description_model, embedding_model, embedding_dimension (384|768|1536|3072). Insert into `search_datasets`; optionally seed `search_documents` (copy content from documents, no description/embedding yet). Set status = 'uploaded'.

### Task 7: Search datasets UI

**Files:** Pages/routes: list datasets; dataset detail with list of search configs; form to create search config (name, prompt, models, dimension). Wire to APIs above.

---

## Slice 3: Describe (LLM)

### Task 8: Describe API / job

**Files:** Create `app/api/search-datasets/[id]/describe/route.ts` (or background job). For each `search_document` with null description, call LLM with `description_prompt` + document content; write description to `search_documents.description`. Update `search_datasets.status` to 'described' when done.

### Task 9: Describe UI

**Files:** Button or action on search-dataset detail to "Run describe"; call describe API; show progress or success.

---

## Slice 4: Vectorize (embeddings)

### Task 10: Vectorize API / job

**Files:** Create `app/api/search-datasets/[id]/vectorize/route.ts`. For each `search_document`, embed (content + description) with configured embedding_model; write to the correct `embedding_*` column per `search_datasets.embedding_dimension`. Update status to 'vectorized'.

### Task 11: Vectorize UI

**Files:** Button "Run vectorize" on search-dataset detail; call vectorize API; show success.

---

## Slice 5: Search (hybrid)

### Task 12: Search API

**Files:** Create `app/api/search-datasets/[id]/search/route.ts`. Query params: `q`, optional `k`. Hybrid: vector search (using the correct embedding_* column) + FTS on `search_vector`; combine/rank; return top-k doc IDs and snippets.

### Task 13: Search UI

**Files:** Search box on search-dataset detail; call search API; display ranked results.

---

## Slice 6: Validation (upload queries + run, recall@k / MRR)

### Task 14: Validation sets API

**Files:** Create `app/api/search-datasets/[id]/validation-sets/route.ts` — GET list, POST create (name). Create `app/api/validation-sets/[id]/queries/route.ts` — POST body: array of `{ query, expected_document_ids }` to bulk insert `validation_queries`.

### Task 15: Run validation API

**Files:** Create `app/api/validation-sets/[id]/run/route.ts`. For each validation_query, run search with query; compute recall@k and MRR vs expected_document_ids. Return per-query and aggregate metrics (no need to store in DB per design).

### Task 16: Validation UI

**Files:** Page to create validation set, upload query + expected IDs (JSON or form); button "Run validation"; display recall@k and MRR.

---

## Execution order

1. Slice 1 (Tasks 1–3): Supabase client + Upload. Required before anything else.
2. Slice 2 (Tasks 4–7): Search datasets CRUD.
3. Slice 3 (Tasks 8–9): Describe.
4. Slice 4 (Tasks 10–11): Vectorize.
5. Slice 5 (Tasks 12–13): Search.
6. Slice 6 (Tasks 14–16): Validation.

Test after each slice (manual or automated). DRY: reuse `createServerSupabase()` and shared types (e.g. dataset_status, embedding dimensions) where possible.
