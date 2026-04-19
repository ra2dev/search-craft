-- Validation runs: store results and metrics for each execution of a
-- validation_set against a specific search_dataset (config).
create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  validation_set_id uuid not null references public.validation_sets(id) on delete cascade,
  search_dataset_id uuid not null references public.search_datasets(id) on delete cascade,
  run_at timestamptz not null default now(),
  params jsonb default '{}',
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on column public.validation_runs.params is 'e.g. { "top_k": 10 }';
comment on column public.validation_runs.metrics is
  'e.g. { "pass_rate": 0.82, "recall_at_max_rank": 0.9, "mrr": 0.78, "per_query": [...] }';
