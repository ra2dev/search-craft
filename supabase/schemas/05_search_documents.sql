-- Search documents: per-search-dataset copy of content + description + embedding (for FTS and vector search)
-- content is denormalized from documents for FTS; description and one of the embedding_* columns filled by describe/vectorize
-- Exactly one of embedding_384, embedding_768, embedding_1536, embedding_3072 is set per row (matches search_datasets.embedding_dimension)
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

-- Full-text search: generated column for keyword search
alter table public.search_documents
  add column search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(content, '') || ' ' || coalesce(description, '')
    )
  ) stored;
