-- Validation sets: named collection of test queries scoped to a dataset.
-- Many validation sets per dataset; any set can be run against any
-- search_dataset (config) derived from the same parent dataset.
create table public.validation_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dataset_id, name)
);
