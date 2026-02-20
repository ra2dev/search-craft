# Domain Entities Design

**Date:** 2025-02-19  
**Scope:** Domain/data entities only (what lives in the DB long-term). No jobs, runs, or stored validation results.

## Decision

**Approach 1 — Current schema only.** No new tables. Existing Supabase schemas are sufficient.

## Entity List

| Entity | Purpose |
|--------|--------|
| `dataset_status` (enum) | `uploaded` \| `described` \| `vectorized` — used on `search_datasets` |
| `datasets` | One per uploaded JSON (e.g. emoji list, meme list). Id, name, created_at. |
| `documents` | One row per item in a dataset. Raw content + metadata (jsonb). FK → datasets. |
| `search_datasets` | One per search config of a dataset (prompt, description model, embedding model/dimension). FK → datasets; has status; determines which embedding_* column is used. |
| `search_documents` | One row per document per search_dataset: content copy + LLM description + one of embedding_384/768/1536/3072; FTS via generated search_vector. Unique (search_dataset_id, document_id). |
| `validation_sets` | Named set of test queries for one search_dataset. FK → search_datasets. |
| `validation_queries` | One row per test query: query text + expected_document_ids (documents.id). FK → validation_sets. |

## Out of Scope (not domain entities)

- Jobs/runs for describe/vectorize (operational; not stored long-term).
- Stored validation run results (recall@k / MRR computed on demand).
- Separate upload/batch table (one dataset per upload is enough).

## Schema Location

Implemented in `supabase/schemas/`:

- `01_types.sql` — dataset_status
- `02_datasets.sql` — datasets
- `03_documents.sql` — documents
- `04_search_datasets.sql` — search_datasets
- `05_search_documents.sql` — search_documents (+ FTS)
- `06_validation_sets.sql` — validation_sets
- `07_validation_queries.sql` — validation_queries
