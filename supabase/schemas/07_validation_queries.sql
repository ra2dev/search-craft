-- Validation queries: one row per test query with expected document IDs (source documents.id)
create table public.validation_queries (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  query text not null,
  expected_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
