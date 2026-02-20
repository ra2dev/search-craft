-- Validation sets: named collection of test queries for a search dataset
create table public.validation_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  search_dataset_id uuid not null references public.search_datasets(id) on delete cascade,
  created_at timestamptz not null default now()
);
