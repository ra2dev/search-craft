-- Validation queries: one row per test query with expected document IDs
-- (source documents.id) and a per-query rank threshold.
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
