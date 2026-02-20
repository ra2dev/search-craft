-- Search datasets: one per "search config" of a dataset (prompt + description model + embedding model)
-- One dataset can have many search datasets (e.g. "Emoji GPT-4" vs "Emoji Claude")
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
