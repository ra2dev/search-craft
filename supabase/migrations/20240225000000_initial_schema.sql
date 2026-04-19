-- Initial schema migration (from supabase/schemas/)

-- Extensions
create extension if not exists vector;

-- Types
create type dataset_status as enum (
  'uploaded',
  'described',
  'vectorized'
);

-- Tables
create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create table public.search_datasets (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  description_prompt text,
  description_model text,
  embedding_model text,
  embedding_dimension smallint,
  status dataset_status not null default 'uploaded',
  created_at timestamptz not null default now()
);

comment on column public.search_datasets.embedding_dimension is 'One of 384, 768, 1536, 3072. Determines which search_documents.embedding_* column is used for this search_dataset.';

create table public.search_documents (
  id uuid primary key default gen_random_uuid(),
  search_dataset_id uuid not null references public.search_datasets(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  description text,
  embedding_384 vector(384),
  embedding_768 vector(768),
  embedding_1536 vector(1536),
  embedding_3072 halfvec(3072),
  created_at timestamptz not null default now(),
  unique (search_dataset_id, document_id)
);

alter table public.search_documents
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(content, '') || ' ' || coalesce(description, '')
    )
  ) stored;

create table public.validation_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  search_dataset_id uuid not null references public.search_datasets(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.validation_queries (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  query text not null,
  expected_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  run_at timestamptz not null default now(),
  params jsonb default '{}',
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on column public.validation_runs.params is 'e.g. { "top_k": 10, "vector_weight": 0.7 }';
comment on column public.validation_runs.metrics is 'e.g. { "recall_at_5": 0.85, "recall_at_10": 0.92, "mrr": 0.78 }';

-- Indexes
create index documents_dataset_id_idx on public.documents(dataset_id);
create index search_datasets_dataset_id_idx on public.search_datasets(dataset_id);
create index search_documents_search_vector_idx on public.search_documents using gin(search_vector);
create index search_documents_embedding_384_idx on public.search_documents using hnsw (embedding_384 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_768_idx on public.search_documents using hnsw (embedding_768 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_1536_idx on public.search_documents using hnsw (embedding_1536 vector_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_embedding_3072_idx on public.search_documents using hnsw (embedding_3072 halfvec_cosine_ops) with (m = 16, ef_construction = 64);
create index search_documents_search_dataset_id_idx on public.search_documents(search_dataset_id);
create index search_documents_document_id_idx on public.search_documents(document_id);
create index validation_sets_search_dataset_id_idx on public.validation_sets(search_dataset_id);
create index validation_queries_validation_set_id_idx on public.validation_queries(validation_set_id);
create index validation_runs_validation_set_id_idx on public.validation_runs(validation_set_id);

-- RLS
alter table public.datasets enable row level security;
alter table public.documents enable row level security;
alter table public.search_datasets enable row level security;
alter table public.search_documents enable row level security;
alter table public.validation_sets enable row level security;
alter table public.validation_queries enable row level security;
alter table public.validation_runs enable row level security;

create policy "Allow all on datasets" on public.datasets for all using (true) with check (true);
create policy "Allow all on documents" on public.documents for all using (true) with check (true);
create policy "Allow all on search_datasets" on public.search_datasets for all using (true) with check (true);
create policy "Allow all on search_documents" on public.search_documents for all using (true) with check (true);
create policy "Allow all on validation_sets" on public.validation_sets for all using (true) with check (true);
create policy "Allow all on validation_queries" on public.validation_queries for all using (true) with check (true);
create policy "Allow all on validation_runs" on public.validation_runs for all using (true) with check (true);
